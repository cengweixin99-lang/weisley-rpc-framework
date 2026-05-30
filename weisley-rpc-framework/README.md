# Weisley RPC Framework

一个使用 Node.js + TypeScript 从 0 手写的轻量级 RPC 框架项目。这个仓库的目标不是立刻复刻 gRPC 或 Dubbo 的完整生态，而是在一周内把 RPC 最核心的链路亲手跑通：协议、编码、TCP 传输、服务注册、远程调用、请求响应匹配、超时与错误处理。

## RPC 是什么

RPC 是 Remote Procedure Call，中文通常叫“远程过程调用”。它的目标是让调用方像调用本地函数一样调用远程机器上的函数。

普通 HTTP API 的思维通常是：

```text
GET /users/1
POST /orders
```

RPC 的思维更像：

```text
UserService.getUser(1)
OrderService.createOrder(payload)
```

调用方不直接关心 URL、请求体格式、响应解析等细节，而是通过客户端代理调用一个远程方法。RPC 框架负责把这次方法调用转换成网络请求，再在服务端找到对应服务和方法执行，最后把结果传回客户端。

## 市面上常见 RPC 产品特征

### gRPC

gRPC 是 Google 开源的现代 RPC 框架，典型特征是使用 Protocol Buffers 作为接口定义语言和消息序列化格式，底层基于 HTTP/2，支持多语言、流式调用、超时、取消、认证等能力。它适合跨语言、高性能、强契约的微服务通信。

### Apache Dubbo

Dubbo 是偏服务治理的一体化 RPC 框架，除了远程调用本身，还强调服务发现、负载均衡、流量路由、动态配置、可观测性、认证授权等微服务治理能力。Dubbo 适合大型微服务集群，尤其是 Java 生态里比较常见。

### Apache Thrift

Thrift 更偏跨语言 IDL + 代码生成路线。开发者先定义接口文件，再生成不同语言的服务端和客户端代码。它的特点是跨语言、序列化协议和传输协议可选，适合多语言系统之间建立统一通信契约。

### tRPC

tRPC 是 TypeScript 生态里很有代表性的类型安全 RPC 方案。它强调端到端类型安全，前后端共享 TypeScript 类型，很多场景下不需要额外代码生成。它非常适合全栈 TypeScript 项目，但不以跨语言为主要目标。

### 本项目的定位

本项目会吸收这些产品的核心思想，但第一阶段只做最小闭环：

```text
类型共享：借鉴 tRPC 的 TypeScript 类型体验
协议分层：借鉴 gRPC/Thrift 的协议抽象
服务注册：借鉴 Dubbo 的服务暴露和发现思想
TCP 编解码：理解传统 RPC 的网络传输基础
```

## RPC 原理

一次 RPC 调用通常包含这些步骤：

```text
1. 客户端调用本地代理方法，例如 userService.getUser(1)
2. 代理层把方法名、服务名、参数、请求 ID 组装成 RpcRequest
3. 序列化层把 RpcRequest 转成 Buffer
4. 协议层给 Buffer 加上消息头，例如 4 字节长度前缀
5. 传输层通过 TCP 把二进制数据发送给服务端
6. 服务端从 TCP 流里拆出完整消息，反序列化成 RpcRequest
7. 服务端根据 service + method 找到本地实现并执行
8. 服务端把执行结果或异常封装成 RpcResponse
9. RpcResponse 经过序列化和协议编码后返回客户端
10. 客户端根据 response.id 找到 pending Promise，resolve 或 reject
```

这个过程的关键点是：远程调用本质上不是魔法，而是“本地代理 + 协议编码 + 网络传输 + 服务端反射执行 + 响应匹配”。

## RPC 实现机制

### 1. 服务代理

客户端不会手写每一个远程方法的网络请求，而是通过 `Proxy` 动态拦截方法调用：

```ts
const userService = client.createProxy<UserService>("UserService");
const user = await userService.getUser(1);
```

`getUser(1)` 会被转换为：

```ts
client.call("UserService", "getUser", [1]);
```

### 2. 请求 ID 与 Promise 映射

客户端每发出一个请求，就生成一个唯一 `id`，并保存：

```text
requestId -> { resolve, reject, timer }
```

服务端响应回来后，客户端根据 `response.id` 找到对应 Promise。这样同一个 TCP 连接上可以并发发送多个请求。

### 3. 序列化

第一版使用 JSON 序列化，优点是简单、可读、方便调试。后续可以扩展 MessagePack、Protocol Buffers 等二进制序列化方案。

### 4. TCP 粘包拆包

TCP 是流式协议，不保证一次 `write` 对应一次 `data`。所以本项目使用长度前缀协议：

```text
[4 bytes body length][json body]
```

接收端通过 `BufferQueue` 缓存数据。只有当缓冲区里攒够一个完整包时，才交给上层解码。

### 5. 服务注册与方法调用

服务端维护一个本地服务表：

```text
UserService -> userService instance
```

收到请求后，根据 `service` 和 `method` 找到真实函数：

```text
UserService.getUser -> userService.getUser
```

然后执行并返回结果。

### 6. 错误处理与超时

服务端异常会被转换为标准 `RpcResponse.error`。客户端请求超过指定时间没有响应，会触发 `RpcTimeoutError`，同时清理 pending map，避免内存泄漏。

## 第一周实现路径

### Day 1：项目环境与协议层

完成 monorepo 环境、TypeScript 配置、`protocol` 包。实现消息类型、JSON 序列化、长度前缀编码、`BufferQueue`。

验收目标：

```text
可以把 RpcRequest 编码为 Buffer
可以从半包/粘包场景中解出完整 RpcRequest
```

### Day 2：服务端主链路

实现 TCP Server、服务注册表、方法查找、方法执行、响应编码。

验收目标：

```text
服务端可以注册 UserService
客户端用原始 TCP 发请求时，服务端能执行并返回结果
```

### Day 3：客户端主链路

实现 TCP Client、请求 ID、pending Promise、响应匹配。

验收目标：

```text
client.call("UserService", "getUser", [1]) 可以拿到远程结果
```

### Day 4：类型安全代理

实现 `createProxy<T>()`，让调用体验接近本地方法。

验收目标：

```text
const userService = client.createProxy<UserService>("UserService")
await userService.getUser(1)
```

IDE 能提示方法名、参数类型和返回类型。

### Day 5：稳定性增强

补超时、错误码、连接关闭处理、服务不存在、方法不存在等场景。

验收目标：

```text
调用不存在的方法时返回 METHOD_NOT_FOUND
服务端抛错时客户端收到 RpcError
超时请求会被 reject 并清理
```

### Day 6：扩展能力

加入简单连接管理、心跳或负载均衡中的一个。建议优先做心跳，因为它能帮助理解连接存活检测。

验收目标：

```text
客户端能感知连接断开
服务端可以处理多个客户端连接
```

### Day 7：测试、文档与示例

补单元测试、端到端 example、README、架构图和后续路线。

验收目标：

```text
pnpm build 通过
example server/client 可以跑通
README 能解释清楚项目设计和学习路径
```

## 项目结构

```text
weisley-rpc-framework/
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── README.md
└── packages/
    ├── protocol/
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/
    │       ├── buffer-queue.ts
    │       ├── codec.ts
    │       ├── constants.ts
    │       ├── packet.ts
    │       ├── serializer.ts
    │       ├── types.ts
    │       └── index.ts
    │
    ├── core/
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/
    │       ├── errors.ts
    │       ├── types.ts
    │       ├── client/
    │       │   ├── connection.ts
    │       │   ├── pending-request.ts
    │       │   ├── proxy.ts
    │       │   └── rpc-client.ts
    │       ├── server/
    │       │   ├── method-invoker.ts
    │       │   ├── rpc-server.ts
    │       │   └── service-registry.ts
    │       └── index.ts
    │
    └── example/
        ├── package.json
        ├── tsconfig.json
        └── src/
            ├── share/
            │   └── user-service.ts
            ├── server.ts
            └── client.ts
```

## 快速开始

安装依赖：

```bash
pnpm install
```

构建：

```bash
pnpm build
```

启动服务端：

```bash
pnpm dev:server
```

另开一个终端启动客户端：

```bash
pnpm dev:client
```

## 参考资料

- [gRPC Introduction](https://grpc.io/docs/what-is-grpc/introduction/)
- [gRPC Official Site](https://grpc.io/)
- [Apache Dubbo Introduction](https://dubbo.apache.org/en/overview/what/)
- [Apache Dubbo Architecture](https://dubbo.apache.org/en/overview/what/architecture/)
- [tRPC Official Site](https://trpc.io/)
- [Apache Thrift](https://thrift.apache.org/)
