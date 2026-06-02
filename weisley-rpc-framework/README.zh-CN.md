# Weisley RPC Framework

这是一个使用 Node.js + TypeScript 从 0 手写的轻量级 RPC 框架。项目目标不是复刻 gRPC 或 Dubbo 的完整生态，而是在一周内把 RPC 最核心的机制亲手跑通：协议编码、TCP 传输、服务注册、远程调用、请求响应匹配、超时、错误处理、类型安全代理、连接清理和心跳检测。

## RPC 是什么

RPC 是 Remote Procedure Call，中文通常叫“远程过程调用”。它让客户端可以像调用本地方法一样，调用另一个进程甚至另一台机器上的方法。

HTTP API 通常长这样：

```text
GET /users/1
POST /orders
```

RPC 更像这样：

```text
UserService.getUser(1)
OrderService.createOrder(payload)
```

不过 RPC 并不是魔法。框架会把本地方法调用转换成网络消息，发送给服务端，服务端找到对应方法执行，再把结果返回给客户端。

## 常见 RPC 产品

### gRPC

gRPC 是 Google 开源的现代 RPC 框架，常用 Protocol Buffers 作为接口定义和序列化格式，底层基于 HTTP/2，支持多语言、流式调用、超时、取消、认证等能力。

### Apache Dubbo

Dubbo 更偏向服务治理，除了 RPC 调用，还提供服务发现、负载均衡、路由、流量治理、动态配置、可观测性和权限控制等能力，常见于 Java 微服务生态。

### Apache Thrift

Thrift 走 IDL + 代码生成路线。开发者先定义服务契约，再生成不同语言的客户端和服务端代码，适合多语言系统之间建立统一接口。

### tRPC

tRPC 是 TypeScript 生态里的类型安全 RPC 方案，强调端到端类型推导，非常适合前后端共享 TypeScript 类型的全栈项目。

## 本项目定位

本项目吸收这些框架的核心思想，但第一版只做轻量闭环：

```text
类型共享：使用 TypeScript 服务接口获得调用提示
协议分层：显式设计消息模型、序列化、编解码
服务注册：服务端维护本地服务表
TCP 传输：基于长度前缀的 JSON over TCP
可靠性基础：超时、连接关闭清理、坏连接隔离、心跳 ping/pong
```

## RPC 调用流程

一次远程调用大致经过这些步骤：

```text
1. 客户端调用 userService.getUser(1)
2. Proxy 把它转换成 client.call("UserService", "getUser", [1])
3. RpcClient 构造带唯一 id 的 RpcRequest
4. JsonSerializer 把消息转换成 Buffer
5. RpcCodec 给 body 加上 4 字节长度头
6. RpcConnection 通过 TCP socket.write 发送数据
7. RpcServer 从 TCP 字节流中解码出 RpcRequest
8. MethodInvoker 找到并执行本地服务方法
9. 服务端把结果封装成 RpcResponse
10. 客户端根据 response.id 找到 pending Promise 并 resolve/reject
```

核心链路是：

```text
本地代理调用
  -> 协议编码
  -> TCP 传输
  -> 服务端方法执行
  -> 响应匹配
```

## 协议设计

本项目使用长度前缀 JSON 协议：

```text
[4 bytes body length][JSON body]
```

当前协议消息类型：

```ts
type RpcMessage = RpcRequest | RpcResponse | RpcPing | RpcPong;
```

消息含义：

```text
request   客户端发给服务端的业务请求
response  服务端返回给客户端的业务响应
ping      客户端发给服务端的心跳消息
pong      服务端返回给客户端的心跳响应
```

所有消息都有 `type` 字段，这样后续可以继续扩展：

```text
cancel
stream
metadata
auth
```

## 模块说明

`packages/protocol` 是协议层：

```text
types.ts          协议消息模型
serializer.ts     RpcMessage <-> JSON Buffer
packet.ts         body Buffer <-> 长度前缀 packet
buffer-queue.ts   缓存 TCP chunk，处理半包/粘包
codec.ts          串联 serializer、packet 和 BufferQueue
```

`packages/core` 是 RPC 运行时：

```text
server/service-registry.ts   服务端本地服务表
server/method-invoker.ts     RpcRequest -> 本地方法 -> RpcResponse
server/rpc-server.ts         TCP 服务端、请求分发、ping/pong
client/connection.ts         TCP 客户端、pending map、超时、心跳
client/rpc-client.ts         客户端公开 API
client/proxy.ts              类型安全代理
```

`packages/example` 是端到端示例，包含共享的 TypeScript 服务接口。

## 已实现能力

```text
协议编解码
TCP 半包/粘包处理
服务注册和方法调用
客户端 requestId -> Promise 映射
请求超时
服务端错误包装
连接关闭时 pending 清理
服务端坏 packet 隔离
类型安全代理调用
ping/pong 心跳
心跳超时 HEARTBEAT_TIMEOUT
```

心跳机制：

```text
客户端每隔 heartbeatIntervalMs 发送 ping
服务端收到 ping 返回 pong
客户端收到 pong 更新 lastPongAt
如果 heartbeatTimeoutMs 内没有 pong，连接会被销毁，pending 请求会被 reject
```

## 一周实现路线

### Day 1：协议层

实现协议类型、JSON 序列化、长度前缀编码、BufferQueue 和 RpcCodec。

验收：

```text
RpcMessage 可以编码成 TCP packet
完整 packet 可以解码
半包和粘包可以正确处理
```

### Day 2：服务端运行时

实现 ServiceRegistry、MethodInvoker 和 RpcServer。

验收：

```text
服务端可以注册 UserService
服务端可以接收 RpcRequest
服务端可以执行本地方法并返回 RpcResponse
```

### Day 3：客户端运行时

实现 RpcClient 和 RpcConnection。

验收：

```text
client.call("UserService", "getUser", [1]) 可以拿到远程结果
服务端错误会让客户端 reject
请求超时会 reject
连接关闭会清理 pending
```

### Day 4：类型安全代理

实现 `createProxy<T>()`。

验收：

```ts
const userService = client.createProxy<UserService>("UserService");
await userService.getUser(1);
```

IDE 可以提示方法名、参数类型和返回类型。

### Day 5：稳定性增强

补动态测试端口、连接关闭测试、非法 packet 处理和坏连接隔离。

验收：

```text
坏协议数据只关闭当前 socket
server 仍能处理新的正常连接
测试不依赖固定端口
```

### Day 6：心跳

升级协议消息类型，加入 `ping/pong`，实现客户端心跳检测。

验收：

```text
服务端收到 ping 返回 pong
心跳不影响普通 RPC 调用
收不到 pong 时触发 HEARTBEAT_TIMEOUT
```

### Day 7：文档和示例

同步 README、清理协议类型定义、更新 example，并做最终验证。

验收：

```text
protocol tests 通过
core tests 通过
build 通过
example server/client 跑通
```

## 项目结构

```text
weisley-rpc-framework/
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── README.md
├── README.zh-CN.md
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
pnpm.cmd install
```

构建：

```bash
pnpm.cmd run build
```

启动服务端：

```bash
pnpm.cmd dev:server
```

另开一个终端启动客户端：

```bash
pnpm.cmd dev:client
```

预期客户端输出：

```text
{ id: 1, name: 'Alice' }
[
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' }
]
```

## 常用命令

```bash
pnpm.cmd --filter @weisley-rpc/protocol test
pnpm.cmd --filter @weisley-rpc/core test
pnpm.cmd run build
```

## 参考资料

- [gRPC Introduction](https://grpc.io/docs/what-is-grpc/introduction/)
- [Apache Dubbo Overview](https://dubbo.apache.org/en/overview/what/)
- [Apache Thrift](https://thrift.apache.org/)
- [tRPC](https://trpc.io/)
