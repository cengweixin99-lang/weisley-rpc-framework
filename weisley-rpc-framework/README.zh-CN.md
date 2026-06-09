# Weisley RPC Framework

一个使用 Node.js + TypeScript 从 0 手写的轻量级 RPC 框架。

这个项目的目标不是复刻 gRPC、Dubbo 或 Thrift 的完整生态，而是把 RPC 框架最核心的机制亲手实现一遍：协议编解码、TCP 长连接、粘包拆包、服务注册、远程方法调用、请求响应匹配、超时控制、心跳检测、自动重连、服务发现、负载均衡、故障转移、连接池、调用指标和类型安全代理。

如果用一句话概括：

```text
这是一个基于 TCP 字节流、自定义长度前缀协议和 TypeScript 类型系统实现的教学型 RPC 框架。
```

## 项目定位

本项目更适合作为后端基础能力和分布式系统方向的学习项目，而不是业务 CRUD 项目。

它重点展示的是：

```text
1. 如何从 TCP 字节流上设计一个 RPC 协议
2. 如何处理粘包、半包和消息边界
3. 如何用 requestId 匹配异步响应
4. 如何设计客户端 pending 请求表
5. 如何实现服务端方法注册和反射调用
6. 如何处理超时、连接关闭、心跳和异常连接
7. 如何实现服务发现、负载均衡和故障转移
8. 如何通过 RetryPolicy 控制重试边界
9. 如何通过连接池复用长连接并提升并发能力
10. 如何提供连接状态统计和调用级 Metrics
```

这个项目不是为了证明“我会调用某个 RPC 框架”，而是为了证明“我理解 RPC 框架底层是怎么工作的”。

## RPC 是什么

RPC 是 Remote Procedure Call，中文一般叫远程过程调用。

它让调用方可以像调用本地方法一样，调用另一个进程、另一台机器上的方法。

普通 HTTP API 可能长这样：

```text
GET /users/1
POST /orders
```

RPC 调用更像这样：

```ts
await userService.getUser(1);
await orderService.createOrder(payload);
```

但 RPC 并不是魔法。一次远程调用背后一般会经历：

```text
本地方法调用
-> 代理对象拦截
-> 构造 RPC 请求
-> 序列化
-> 编码成网络包
-> 通过 TCP/HTTP 发送
-> 服务端解码
-> 找到本地服务方法
-> 执行方法
-> 返回响应
-> 客户端根据 requestId 找到对应 Promise
-> resolve/reject 给调用方
```

所以 RPC 的本质是：

```text
把本地方法调用转换成跨进程网络通信。
```

## 市面常见 RPC 产品

### gRPC

gRPC 是 Google 开源的现代 RPC 框架，常见组合是：

```text
IDL: Protocol Buffers
传输: HTTP/2
能力: 多语言、流式调用、deadline、metadata、拦截器、认证、负载均衡等
```

它适合多语言微服务系统，尤其适合对性能、契约和跨语言能力要求较高的场景。

### Apache Dubbo

Dubbo 更偏向 Java 微服务治理体系。它不只是 RPC 调用框架，还包含：

```text
服务注册
服务发现
负载均衡
路由
容错
流量治理
动态配置
可观测性
权限控制
```

Dubbo 的优势是服务治理能力强，常用于大型 Java 微服务体系。

### Apache Thrift

Thrift 走 IDL + 代码生成路线。开发者先定义服务契约，再生成不同语言的客户端和服务端代码。

它适合多语言系统之间建立统一服务契约。

### tRPC

tRPC 是 TypeScript 生态里的 RPC 方案，强调端到端类型安全，不需要额外 IDL。

它适合前后端都使用 TypeScript 的全栈项目。

### 本项目与它们的区别

本项目不会直接追求完整生态，而是聚焦底层机制：

```text
gRPC 更成熟，本项目更适合学习 RPC 底层原理
Dubbo 服务治理更完整，本项目只实现核心服务发现和故障转移
Thrift 依赖 IDL 生成，本项目依赖 TypeScript 类型共享
tRPC 偏 HTTP/全栈类型安全，本项目偏 TCP 字节流和底层网络机制
```

## 核心能力总览

当前已经实现的能力：

```text
协议层:
  - RpcMessage 基础模型
  - JSON 序列化和反序列化
  - 4 字节长度前缀 packet
  - TCP 粘包/半包处理
  - 最大 packet 长度限制

服务端:
  - TCP server
  - 服务注册 ServiceRegistry
  - 方法调用 MethodInvoker
  - request/response 处理
  - ping/pong 心跳响应
  - 非法 packet 隔离
  - 活跃连接统计

客户端:
  - RpcClient public API
  - RpcConnection 长连接
  - requestId -> pending Promise 映射
  - 请求超时
  - 连接关闭时清理 pending 请求
  - 心跳检测
  - 自动重连
  - 类型安全 Proxy 调用

服务发现与容错:
  - Direct 模式
  - Discovery 模式
  - StaticRegistry
  - RoundRobinLoadBalancer
  - Discovery Failover
  - DefaultRetryPolicy
  - Custom RetryPolicy
  - RetryContext

连接池:
  - 每个 endpoint 独立连接池
  - maxConnectionsPerEndpoint
  - 连接轮询复用
  - connectionPromise 防止并发建连竞态
  - 连接状态统计 getConnectionStats()

可观测性:
  - 连接状态统计
  - 调用级 Metrics
  - 按 service.method 统计调用次数、成功次数、失败次数、平均耗时、最近错误码
  - Metrics 快照隔离
  - resetMetrics()
```

## 整体架构

```text
Client Proxy
  |
  v
RpcClient
  |
  +-- Direct Mode ----------------------+
  |                                      |
  +-- Discovery Mode                    |
       |                                |
       v                                |
    Registry                            |
       |                                |
       v                                |
    LoadBalancer                        |
       |                                |
       v                                |
RpcConnectionPool                       |
  |
  v
RpcConnection
  |
  v
RpcCodec
  |
  +-- JsonSerializer
  +-- Packet Encoder/Decoder
  +-- BufferQueue
  |
  v
TCP Socket
  |
  v
RpcServer
  |
  v
ServiceRegistry
  |
  v
MethodInvoker
  |
  v
Business Service
```

## 一次 RPC 调用的完整流程

以调用：

```ts
await userService.getUser(1);
```

为例，完整链路如下：

```text
1. createProxy 创建代理对象
2. 调用 userService.getUser(1)
3. Proxy 捕获方法名 getUser 和参数 [1]
4. 转成 client.call("UserService", "getUser", [1])
5. RpcClient 创建 RpcRequest
6. 为请求生成唯一 requestId
7. 根据 mode 判断走 Direct 还是 Discovery
8. Direct 模式直接使用 host/port
9. Discovery 模式通过 registry.lookup("UserService") 获取 endpoints
10. 通过 loadBalancer.select(...) 选择一个 endpoint
11. 根据 endpoint 找到对应 RpcConnectionPool
12. pool.getConnection() 获取或创建 RpcConnection
13. 如果连接未建立，执行 connection.connect()
14. 如果多个请求同时连接，同一个 connectionPromise 会被共享
15. RpcCodec 将 RpcRequest 编码为 packet
16. RpcConnection.send() 注册 pending 请求
17. socket.write(packet) 发送 TCP 字节流
18. 服务端 socket 收到 data chunk
19. RpcCodec 使用 BufferQueue 处理半包/粘包
20. 解码出 RpcRequest
21. MethodInvoker 查找 UserService.getUser
22. 执行业务方法
23. 返回 RpcResponse
24. 服务端编码 response 并 socket.write()
25. 客户端收到 response
26. 根据 response.id 找到 pending Promise
27. 成功则 resolve(result)
28. 失败则 reject(RpcError)
29. RpcClient 记录 Metrics
30. 调用方拿到最终结果
```

## 协议设计

本项目使用自定义长度前缀协议：

```text
[4 bytes body length][JSON body]
```

前 4 字节使用大端序写入 body 长度：

```ts
header.writeUInt32BE(payload.length, 0);
```

读取时使用：

```ts
header.readUInt32BE(0);
```

这种设计解决了 TCP 字节流没有消息边界的问题。

### 为什么 TCP 需要处理粘包和半包

TCP 是字节流协议，不是消息协议。

调用方写入：

```text
packet1
packet2
```

接收方可能收到：

```text
packet1 + packet2
```

也可能收到：

```text
packet1 的前半部分
packet1 的后半部分 + packet2
```

所以协议层必须自己定义消息边界。

本项目通过：

```text
4 字节长度头
BufferQueue 缓冲区
RpcCodec 循环解码
```

来处理这些情况。

### 消息模型

当前协议消息包括：

```ts
type RpcMessage = RpcRequest | RpcResponse | RpcPing | RpcPong;
```

含义：

```text
request   客户端发起业务调用
response  服务端返回业务结果或错误
ping      客户端心跳请求
pong      服务端心跳响应
```

使用 `type` 字段区分消息类型，方便后续继续扩展：

```text
cancel
metadata
stream
auth
```

### 最大包长度限制

协议层定义最大 packet 长度：

```ts
MAX_PACKET_LENGTH = 16 * 1024 * 1024
```

编码时限制自己不能发超大包：

```text
payload.length > MAX_PACKET_LENGTH -> throw RangeError
```

解码时限制对端不能声明超大 body：

```text
bodyLength > MAX_PACKET_LENGTH -> throw RangeError
```

服务端捕获非法 packet 后只关闭当前坏 socket，不影响其他连接。

## 客户端设计

客户端主要由这些模块组成：

```text
RpcClient
RpcConnectionPool
RpcConnection
RetryPolicy
Proxy
```

### RpcClient

`RpcClient` 是客户端入口，负责：

```text
1. 创建 RpcRequest
2. 判断 Direct/Discovery 模式
3. 选择 endpoint
4. 获取连接池中的连接
5. 发起请求
6. 做 failover
7. 记录 metrics
8. 暴露 createProxy()
```

### Direct 模式

Direct 模式直接指定一个固定节点：

```ts
const client = new RpcClient({
  mode: "direct",
  host: "127.0.0.1",
  port: 4000,
});
```

适合：

```text
本地开发
单节点调试
测试用例
明确知道目标节点的场景
```

### Discovery 模式

Discovery 模式通过注册中心和负载均衡器选择节点：

```ts
const client = new RpcClient({
  mode: "discovery",
  registry,
  loadBalancer,
});
```

适合：

```text
多实例服务
故障转移
负载均衡
生产级 RPC 调用模型
```

### 为什么保留 Direct 和 Discovery 两种模式

真实 RPC 框架通常也会有类似能力：

```text
Direct:
  简单、可控、适合本地和测试

Discovery:
  更接近生产环境，支持多节点、负载均衡和容错
```

保留两种模式可以让框架既容易调试，又能逐步扩展到服务治理。

## 服务发现与负载均衡

服务发现抽象：

```ts
interface Registry {
  lookup(serviceName: string): Endpoint[];
}
```

负载均衡抽象：

```ts
interface LoadBalancer {
  select(serviceName: string, endpoints: Endpoint[]): Endpoint;
}
```

当前实现：

```text
StaticRegistry
RoundRobinLoadBalancer
```

`StaticRegistry` 用于本地测试和学习：

```ts
new StaticRegistry({
  UserService: [
    { host: "127.0.0.1", port: 4001 },
    { host: "127.0.0.1", port: 4002 },
  ],
});
```

`RoundRobinLoadBalancer` 用轮询方式选择节点：

```text
server1 -> server2 -> server1 -> server2
```

后续可以扩展：

```text
RandomLoadBalancer
WeightedRoundRobinLoadBalancer
LeastActiveLoadBalancer
NacosRegistry
EtcdRegistry
```

## Discovery Failover

Discovery 模式下，如果选中的 endpoint 不可用，客户端可以切换到下一个 endpoint。

基本流程：

```text
1. registry.lookup(serviceName)
2. loadBalancer.select(...) 选择 endpoint
3. 获取 endpoint 对应连接
4. 尝试 connect/send
5. 如果成功，直接返回
6. 如果失败，交给 RetryPolicy 判断能否重试
7. 如果可重试，尝试下一个 endpoint
8. 如果不可重试，直接抛错
9. 如果所有 endpoint 都失败，抛出最后一次错误
```

这里最重要的是错误分类。

可重试错误通常是连接/网络类错误：

```text
CONNECTION_CLOSED
CONNECTION_NOT_OPEN
CONNECTION_NOT_CONNECTED
RPC_TIMEOUT
HEARTBEAT_TIMEOUT
ECONNREFUSED
ECONNRESET
ETIMEDOUT
EPIPE
```

不可重试错误通常是业务/语义类错误：

```text
METHOD_NOT_FOUND
SERVICE_NOT_FOUND
INVALID_REQUEST
业务方法主动抛出的业务异常
```

因为网络错误说明“这个节点可能有问题”，可以换节点；业务错误说明“请求本身可能有问题”，换节点通常没有意义。

## RetryPolicy 设计

重试策略被抽象成接口：

```ts
interface RetryPolicy {
  shouldRetry(error: unknown, context: RetryContext): boolean;
}
```

上下文信息：

```ts
type RetryContext = {
  serviceName: string;
  attempt: number;
  maxAttempts: number;
  endpoint: Endpoint;
};
```

这样策略可以根据更多信息做判断：

```text
当前调用哪个服务
当前是第几次尝试
最多能尝试几次
当前失败的是哪个 endpoint
```

默认策略只重试网络类和连接类错误。

用户也可以传入自定义策略：

```ts
const client = new RpcClient({
  mode: "discovery",
  registry,
  loadBalancer,
  retryPolicy: {
    shouldRetry(error, context) {
      return context.attempt < context.maxAttempts;
    },
  },
});
```

这个设计的意义是：

```text
RpcClient 不写死重试规则
重试行为可以被替换和扩展
```

## 连接池设计

当前客户端使用按 endpoint 隔离的连接池：

```text
127.0.0.1:4001 -> RpcConnectionPool -> [conn1, conn2]
127.0.0.1:4002 -> RpcConnectionPool -> [conn1, conn2]
```

也就是说：

```text
每个服务节点都有自己的连接池
不同 endpoint 不共享连接
同一个 endpoint 内部可以复用多条 TCP 长连接
```

配置：

```ts
const client = new RpcClient({
  mode: "discovery",
  registry,
  loadBalancer,
  maxConnectionsPerEndpoint: 2,
});
```

含义：

```text
每个 endpoint 最多维护 2 条 TCP 连接
```

### 为什么需要连接池

如果每次 RPC 调用都新建 TCP 连接，会有额外开销：

```text
TCP 三次握手
连接初始化
心跳状态初始化
内核资源分配
```

连接池的价值是：

```text
复用长连接
减少频繁建连
提升并发吞吐
限制单节点连接数量
```

### 为什么一个 RpcConnection 不能连接多个服务端

一个 `RpcConnection` 对应一条 TCP socket。

一条 TCP 连接只连接一对端点：

```text
client ip:client port -> server ip:server port
```

它不能同时连接多个 server。

但一条 TCP 连接可以承载多个 RPC 请求：

```text
request1
request2
request3
```

客户端通过 `requestId` 区分响应：

```text
response.id -> pending map -> resolve 对应 Promise
```

所以：

```text
一个 TCP 连接只连接一对端点
但这对端点之间可以传很多次 RPC 请求/响应
```

## 并发建连保护 connectionPromise

连接池引入后，多个请求可能同时拿到同一个还没连接成功的 `RpcConnection`。

如果不处理，会出现竞态：

```text
请求 A 调 connect()
A 创建 socket，但 TCP 还没 connected
请求 B 调 connect()
B 看到 socket 已存在，直接 return
B 立刻 send()
send 发现 state 不是 connected
B 报 CONNECTION_NOT_CONNECTED
```

所以 `RpcConnection` 里维护：

```ts
private connectionPromise: Promise<void> | null = null;
```

含义：

```text
null:
  当前没有正在进行的连接动作

Promise<void>:
  当前已经有一次 connect 正在进行，其他请求应该等待它
```

正确流程：

```text
请求 A 调 connect()
A 创建 connectionPromise

请求 B 调 connect()
B 发现 connectionPromise 已存在
B 等待同一个 Promise

TCP connected
connectionPromise resolve
A 和 B 都继续 send()
```

这个设计保证：

```text
同一个 RpcConnection 同一时刻最多只有一次真实 doConnect()
多个并发请求共享同一次连接过程
```

## 心跳与重连

客户端支持 heartbeat：

```ts
const client = new RpcClient({
  mode: "direct",
  host: "127.0.0.1",
  port: 4000,
  heartbeatIntervalMs: 1000,
  heartbeatTimeoutMs: 3000,
});
```

流程：

```text
1. 客户端定时发送 ping
2. 服务端收到 ping 返回 pong
3. 客户端收到 pong 更新 lastPongAt
4. 如果超过 heartbeatTimeoutMs 没收到 pong
5. 客户端销毁连接
6. pending 请求全部 reject
7. 如果允许重连，进入 reconnecting 状态
```

自动重连支持：

```text
reconnect
reconnectInitialDelayMs
reconnectMaxDelayMs
```

当前重连主要适合 Direct 模式下同地址恢复：

```text
server1 挂掉
同 host:port 的 server2 启动
client 自动重连成功
```

Discovery 模式下，更重要的是 failover 到其他 endpoint。

## 服务端设计

服务端由三部分组成：

```text
RpcServer
ServiceRegistry
MethodInvoker
```

### ServiceRegistry

服务注册表维护：

```text
serviceName -> implementation
```

例如：

```ts
server.registerService("UserService", {
  async getUser(id: number) {
    return { id, name: "Alice" };
  },
});
```

### MethodInvoker

`MethodInvoker` 负责：

```text
1. 根据 request.service 找服务
2. 根据 request.method 找方法
3. 使用 params 调用方法
4. 成功时包装 RpcResponse
5. 失败时包装错误响应
```

### RpcServer

`RpcServer` 负责：

```text
1. 监听 TCP 端口
2. 为每个 socket 创建独立 RpcCodec
3. 处理 data chunk
4. 解码 request/ping
5. request 交给 MethodInvoker
6. ping 返回 pong
7. 非法 packet 关闭当前 socket
8. 维护当前活跃连接数
```

服务端的坏连接隔离很重要：

```text
某个客户端发非法 packet
只关闭这个客户端 socket
server 本身继续服务其他连接
```

## 类型安全代理

手动调用：

```ts
await client.call("UserService", "getUser", [1]);
```

可以通过 Proxy 包装成：

```ts
type UserService = {
  getUser(id: number): Promise<{ id: number; name: string }>;
};

const userService = client.createProxy<UserService>("UserService");

const user = await userService.getUser(1);
```

这样 IDE 可以提示：

```text
方法名
参数类型
返回值类型
```

这里的 TypeScript 类型只存在于编译期，运行时真正发送的还是：

```text
service: "UserService"
method: "getUser"
params: [1]
```

## 可观测性设计

当前实现了两类轻量观测能力。

### 连接状态统计

客户端提供：

```ts
client.getConnectionStats();
```

返回结构类似：

```ts
{
  "127.0.0.1:4001": {
    total: 2,
    states: {
      idle: 0,
      connecting: 0,
      connected: 2,
      reconnecting: 0,
      closed: 0,
    },
  },
}
```

它可以回答：

```text
现在连了哪些 endpoint
每个 endpoint 有多少条连接
连接分别处于什么状态
```

### 调用级 Metrics

客户端提供：

```ts
client.getMetrics();
client.resetMetrics();
```

按 `service.method` 统计：

```ts
{
  "UserService.getUser": {
    totalCalls: 10,
    successCalls: 9,
    failedCalls: 1,
    totalDurationMs: 37,
    averageDurationMs: 3.7,
    lastErrorCode: "RPC_TIMEOUT",
  },
}
```

它可以回答：

```text
某个 RPC 方法调用了多少次
成功多少次
失败多少次
平均耗时多少
最后一次错误是什么
```

`getMetrics()` 返回的是快照，不会暴露内部对象引用，避免外部代码污染内部统计。

## 项目结构

```text
weisley-rpc-framework/
|-- package.json
|-- pnpm-workspace.yaml
|-- tsconfig.base.json
|-- README.md
|-- README.zh-CN.md
|-- packages/
    |-- protocol/
    |   |-- package.json
    |   |-- tsconfig.json
    |   |-- src/
    |       |-- buffer-queue.ts
    |       |-- buffer-queue.test.ts
    |       |-- codec.ts
    |       |-- codec.test.ts
    |       |-- constants.ts
    |       |-- packet.ts
    |       |-- packet.test.ts
    |       |-- serializer.ts
    |       |-- serializer.test.ts
    |       |-- types.ts
    |       |-- index.ts
    |
    |-- core/
    |   |-- package.json
    |   |-- tsconfig.json
    |   |-- src/
    |       |-- errors.ts
    |       |-- types.ts
    |       |-- index.ts
    |       |-- client/
    |       |   |-- connection.ts
    |       |   |-- connection-pool.ts
    |       |   |-- connection-pool.test.ts
    |       |   |-- pending-request.ts
    |       |   |-- proxy.ts
    |       |   |-- proxy.test.ts
    |       |   |-- retry-policy.ts
    |       |   |-- retry-policy.test.ts
    |       |   |-- rpc-client.ts
    |       |   |-- rpc-client.test.ts
    |       |
    |       |-- discovery/
    |       |   |-- types.ts
    |       |   |-- static-registry.ts
    |       |   |-- static-registry.test.ts
    |       |   |-- round-robin-load-balancer.ts
    |       |   |-- round-robin-load-balancer.test.ts
    |       |
    |       |-- server/
    |           |-- method-invoker.ts
    |           |-- method-invoker.test.ts
    |           |-- rpc-server.ts
    |           |-- rpc-server.test.ts
    |           |-- service-registry.ts
    |           |-- service-registry.test.ts
    |
    |-- example/
        |-- package.json
        |-- tsconfig.json
        |-- src/
            |-- share/
            |   |-- user-service.ts
            |-- server.ts
            |-- client.ts
```

## 模块职责

### packages/protocol

协议层是最底层，不依赖 core。

```text
types.ts:
  定义 RpcRequest、RpcResponse、RpcPing、RpcPong、RpcMessage、Serializer

serializer.ts:
  JsonSerializer，负责 RpcMessage <-> Buffer

packet.ts:
  encodePacket 和 readPacketLength，负责 4 字节长度头

buffer-queue.ts:
  缓冲 TCP chunk，支持按字节读取、peek、处理半包和粘包

codec.ts:
  串联 serializer、packet、BufferQueue，提供 encode/push
```

### packages/core

RPC 运行时。

```text
client/connection.ts:
  单条 TCP 长连接，维护 socket、pending map、心跳、重连、连接状态

client/connection-pool.ts:
  endpoint 级连接池，限制连接数，轮询复用连接

client/rpc-client.ts:
  客户端入口，处理 direct/discovery、failover、metrics、proxy

client/retry-policy.ts:
  重试策略抽象和默认实现

client/proxy.ts:
  类型安全代理

discovery/types.ts:
  Registry、LoadBalancer、Endpoint 抽象

discovery/static-registry.ts:
  静态服务发现

discovery/round-robin-load-balancer.ts:
  轮询负载均衡

server/rpc-server.ts:
  TCP 服务端

server/service-registry.ts:
  服务注册表

server/method-invoker.ts:
  本地方法调用器
```

### packages/example

端到端示例：

```text
share/user-service.ts:
  客户端和服务端共享的 TypeScript 服务接口

server.ts:
  注册真实 UserService 实现

client.ts:
  使用 RpcClient/createProxy 发起远程调用
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

运行服务端：

```bash
pnpm.cmd dev:server
```

另开一个终端运行客户端：

```bash
pnpm.cmd dev:client
```

运行协议层测试：

```bash
pnpm.cmd --filter @weisley-rpc/protocol test
```

运行核心层测试：

```bash
pnpm.cmd --filter @weisley-rpc/core test
```

## 测试覆盖重点

当前测试覆盖了：

```text
protocol:
  - JSON 序列化/反序列化
  - packet 编码/解码
  - 最大 packet 长度限制
  - BufferQueue 字节读取
  - RpcCodec 半包/粘包处理

server:
  - 服务注册
  - 方法调用
  - 方法不存在错误
  - TCP RPC 请求响应
  - ping/pong
  - 非法 packet 隔离

client:
  - 正常远程调用
  - 服务端错误传播
  - 请求超时
  - pending 请求清理
  - 心跳超时
  - 手动关闭不重连
  - 异常断开进入 reconnecting
  - 同端口恢复后自动重连
  - Discovery RoundRobin
  - Discovery Failover
  - 不可重试错误不 failover
  - 自定义 RetryPolicy
  - RetryContext
  - 连接池复用
  - 并发 connect 去重
  - Direct/Discovery 连接池集成
  - 连接状态统计
  - Metrics 统计
  - Metrics 快照隔离
  - resetMetrics
```

## 第一阶段实现路线

### Day 1: 协议层

实现：

```text
RpcMessage 类型
JsonSerializer
encodePacket/readPacketLength
BufferQueue
RpcCodec
```

目标：

```text
能把 RpcMessage 编码成 TCP packet
能从 TCP chunk 中解码消息
能处理半包和粘包
```

### Day 2: 服务端运行时

实现：

```text
ServiceRegistry
MethodInvoker
RpcServer
```

目标：

```text
服务端可以注册服务
可以接收 TCP 请求
可以执行本地方法
可以返回 RpcResponse
```

### Day 3: 客户端运行时

实现：

```text
RpcClient
RpcConnection
pending request map
timeout
error propagation
```

目标：

```text
client.call(...) 可以拿到远程结果
超时会 reject
服务端错误会 reject
连接关闭会清理 pending 请求
```

### Day 4: 类型安全代理

实现：

```text
createProxy<T>()
RpcProxy<T>
```

目标：

```ts
const userService = client.createProxy<UserService>("UserService");
await userService.getUser(1);
```

### Day 5: 稳定性

实现：

```text
动态端口测试
坏 packet 隔离
连接关闭清理
心跳基础
```

目标：

```text
坏客户端不拖垮整个 server
测试不依赖固定端口
连接异常能正确清理
```

### Day 6: 服务发现与容错

实现：

```text
Direct/Discovery 模式
StaticRegistry
RoundRobinLoadBalancer
Discovery Failover
RetryPolicy
RetryContext
```

目标：

```text
多个 endpoint 可以轮询调用
节点不可用可以 failover
业务错误不会无意义重试
用户可以自定义重试策略
```

### Day 7: 连接池与可观测性

实现：

```text
RpcConnectionPool
maxConnectionsPerEndpoint
connectionPromise
getConnectionStats()
getMetrics()
resetMetrics()
```

目标：

```text
连接可以复用
并发建连没有竞态
每个 endpoint 有独立连接池
可以观察连接状态和调用质量
```

## 面试可讲点

这个项目在面试中可以重点讲这些问题。

### 1. TCP 为什么会粘包和半包

回答要点：

```text
TCP 是字节流，不保留应用层消息边界
需要自定义协议边界
本项目用 4 字节长度头 + BufferQueue 解决
```

### 2. 为什么需要 requestId

回答要点：

```text
同一条 TCP 连接可以同时承载多个 RPC 请求
响应返回顺序不一定等于请求发送顺序
需要 requestId 把 response 匹配到对应 Promise
```

### 3. pending map 是什么

回答要点：

```text
pending map 保存 requestId -> resolve/reject/timer
发请求时写入
收到响应时删除并 resolve/reject
超时时删除并 reject
连接关闭时统一 reject
```

### 4. 心跳解决什么问题

回答要点：

```text
TCP 连接可能出现半开状态
仅靠 socket close 不一定及时发现对端异常
心跳可以主动检测连接活性
超时后销毁连接并清理 pending 请求
```

### 5. Direct 和 Discovery 为什么分开

回答要点：

```text
Direct 适合本地开发和单节点调试
Discovery 适合多实例服务和生产容错
显式 mode 可以让配置语义更清楚
```

### 6. Failover 为什么不能重试所有错误

回答要点：

```text
连接错误表示节点可能不可用，可以换节点
业务错误表示请求语义有问题，换节点可能掩盖真实问题
所以需要 RetryPolicy 区分可重试和不可重试错误
```

### 7. connectionPromise 解决什么问题

回答要点：

```text
多个并发请求可能同时调用 connect()
socket 存在不代表 TCP 已 connected
connectionPromise 让并发请求共享同一次连接过程
避免提前 send 导致 CONNECTION_NOT_CONNECTED
```

### 8. 连接池为什么按 endpoint 维度设计

回答要点：

```text
一条 TCP 连接只能连接一对端点
不同 endpoint 不能共享连接
所以每个 endpoint 独立维护连接池
同 endpoint 内部复用多条长连接
```

### 9. 线上 RPC 变慢怎么排查

回答要点：

```text
先看 getMetrics() 中 service.method 的平均耗时和失败率
再看 getConnectionStats() 中连接状态是否异常
如果某 endpoint 连接大量 reconnecting，可能是节点或网络问题
如果失败码集中在 RPC_TIMEOUT，可能是服务端慢或网络阻塞
如果是 METHOD_NOT_FOUND，说明调用契约不一致
```

## 简历表达建议

可以写成：

```text
手写基于 Node.js + TypeScript 的轻量级 RPC 框架，基于 TCP 字节流设计 4 字节长度前缀协议，实现 JSON 序列化、粘包/半包处理、请求响应匹配、服务注册、远程方法调用、心跳检测、超时控制和异常连接隔离。
```

增强版：

```text
实现服务发现与客户端容错能力，支持 Direct/Discovery 两种调用模式，抽象 Registry 与 LoadBalancer，内置 StaticRegistry 和 RoundRobinLoadBalancer，并基于 RetryPolicy 实现 Discovery Failover，区分网络类错误和业务类错误，避免无效重试。
```

连接池版：

```text
实现 endpoint 级客户端长连接池，支持 maxConnectionsPerEndpoint、连接轮询复用和并发建连去重，通过 connectionPromise 避免并发请求在 TCP 握手期间提前发送导致的竞态问题。
```

可观测性版：

```text
实现轻量级可观测能力，提供连接状态统计 getConnectionStats() 与调用级 Metrics，支持按 service.method 维度统计调用次数、成功失败次数、平均耗时和最近错误码，为 RPC 调用质量分析提供基础。
```

## 后续优化方向

### 注册中心适配

当前使用 `StaticRegistry`，后续可以扩展：

```text
NacosRegistry
EtcdRegistry
ConsulRegistry
```

注意：RPC 框架不应该强绑定某个注册中心，而应该依赖 `Registry` 抽象。

### 更丰富的负载均衡

可以继续实现：

```text
Random
WeightedRoundRobin
LeastActive
ConsistentHash
```

### 更完整的 Retry 策略

可以支持：

```text
最大重试次数
重试退避
按服务配置重试
按方法配置重试
幂等请求才允许重试
```

### 熔断和限流

可以增加：

```text
CircuitBreaker
RateLimiter
Bulkhead
```

### 序列化扩展

当前使用 JSON，后续可以增加：

```text
MessagePack
Protobuf
自定义 Serializer 插件
```

### Benchmark

建议新增 `packages/benchmark`：

```text
单连接 QPS
多连接池 QPS
不同 payload 大小延迟
JSON 序列化开销
failover 场景耗时
```

### 日志和 Trace

可以增加：

```text
traceId
metadata
调用链路日志
请求耗时日志
连接状态变更日志
```

## 常用命令

```bash
pnpm.cmd install
pnpm.cmd run build
pnpm.cmd --filter @weisley-rpc/protocol test
pnpm.cmd --filter @weisley-rpc/core test
pnpm.cmd dev:server
pnpm.cmd dev:client
```

## 参考资料

- [gRPC Introduction](https://grpc.io/docs/what-is-grpc/introduction/)
- [Apache Dubbo Overview](https://dubbo.apache.org/en/overview/what/)
- [Apache Thrift](https://thrift.apache.org/)
- [tRPC](https://trpc.io/)

