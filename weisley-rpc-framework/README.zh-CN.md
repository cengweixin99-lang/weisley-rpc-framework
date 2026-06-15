# Weisley RPC Framework

一个使用 Node.js + TypeScript 从 0 手写的轻量级 RPC 框架，用于学习和展示 RPC 底层机制、TCP 自定义协议、服务治理和工程化能力。

这个项目不是为了替代 gRPC、Dubbo 或 Thrift，而是把 RPC 框架的核心链路亲手实现一遍：协议编解码、TCP 粘包拆包、序列化、长连接、请求响应匹配、服务注册、服务发现、负载均衡、故障转移、心跳、重连、连接池、熔断、限流、压缩、大小限制、可观测性和优雅关闭。

一句话概括：

```text
这是一个基于 TCP 字节流、自定义二进制协议头和 TypeScript 类型系统实现的教学型 RPC 框架。
```

## RPC 是什么

RPC 是 Remote Procedure Call，中文通常叫远程过程调用。它让调用方可以像调用本地方法一样，调用另一个进程或另一台机器上的方法。

普通 HTTP API 可能是：

```text
GET /users/1
POST /orders
```

RPC 调用更像：

```ts
await userService.getUser(1);
await orderService.createOrder(payload);
```

一次 RPC 调用背后通常会经历：

```text
本地代理方法调用
-> 构造 RpcRequest
-> 序列化
-> 编码成 TCP packet
-> 服务端解码
-> 路由到本地服务方法
-> 执行业务方法
-> 返回 RpcResponse
-> 客户端根据 requestId 匹配 pending Promise
-> resolve/reject 给调用方
```

## 市面常见 RPC 框架

### gRPC

gRPC 通常使用 Protocol Buffers + HTTP/2，支持多语言、流式调用、deadline、metadata、拦截器、认证和负载均衡。它适合多语言微服务系统。

### Apache Dubbo

Dubbo 更偏 Java 微服务治理体系，除了 RPC 调用，还强调注册中心、服务发现、路由、负载均衡、容错、限流、动态配置和可观测性。

### Apache Thrift

Thrift 走 IDL + 多语言代码生成路线，适合跨语言系统之间建立统一服务契约。

### tRPC

tRPC 更偏 TypeScript 全栈场景，强调端到端类型安全，通常基于 HTTP，不重点解决底层 TCP 协议和服务治理问题。

### 本项目定位

```text
gRPC 更成熟，本项目更适合学习 RPC 底层原理
Dubbo 服务治理更完整，本项目实现核心治理能力雏形
Thrift 依赖 IDL 生成，本项目依赖 TypeScript 共享接口
tRPC 偏全栈 HTTP，本项目偏 TCP 字节流和自定义协议
```

## 当前核心能力

### 协议层

- 自定义 TCP 二进制 packet header。
- 支持 magic number、protocol version、serializer id、message type、flags、body length。
- 支持 TCP 粘包、半包处理。
- 支持 JSON Serializer。
- 支持 Protobuf Serializer。
- 支持 Gzip 压缩。
- 支持压缩前 body 限制和解压后 body 限制。
- 支持非法 magic、非法 version、超大 packet 隔离。

### 服务端

- TCP RPC Server。
- 服务注册 `ServiceRegistry`。
- 方法调用 `MethodInvoker`。
- request/response 处理。
- ping/pong 心跳响应。
- 坏连接隔离。
- 活跃连接统计。
- 生命周期状态：`idle`、`listening`、`draining`、`closed`。
- 优雅关闭 graceful shutdown。
- draining 期间拒绝新请求并返回 `SERVER_DRAINING`。

### 客户端

- Direct 模式。
- Discovery 模式。
- requestId 到 pending Promise 映射。
- 请求超时。
- 连接关闭时清理 pending 请求。
- 心跳检测。
- 自动重连。
- 类型安全 Proxy 调用。
- endpoint 级连接池。
- 并发 connect 去重。
- 连接状态统计。
- 调用 metrics。

### 服务治理

- `StaticRegistry`。
- `RoundRobinLoadBalancer`。
- `RandomLoadBalancer`。
- `WeightedRoundRobinLoadBalancer`。
- `LeastActiveLoadBalancer`。
- Discovery Failover。
- `RetryPolicy`。
- 全局重试配置。
- 方法级重试配置。
- 指数退避 backoff。
- `SERVER_DRAINING` 自动 failover。
- 熔断器 CircuitBreaker。
- 令牌桶限流 RateLimiter。

### 可观测性

- traceId metadata 透传。
- requestId 日志字段。
- 客户端成功/失败/限流/熔断/重试日志。
- 服务端成功/失败/非法连接日志。
- `getMetrics()` 调用指标。
- `getConnectionStats()` 连接池状态。
- `getState()` 服务端生命周期状态。

## 自定义协议设计

当前 packet header 是 10 字节：

```text
0-1   magic         2 bytes   固定魔数，识别 Weisley RPC 协议
2     version       1 byte    协议版本
3     serializerId  1 byte    1=json, 2=protobuf
4     messageType   1 byte    1=request, 2=response, 3=ping, 4=pong
5     flags         1 byte    bit0=compressed
6-9   bodyLength    4 bytes   body 长度
10..  body          N bytes   序列化后的 RpcMessage
```

这个设计解决了几个问题：

- `magic` 判断收到的是不是当前 RPC 协议。
- `version` 支持协议演进。
- `serializerId` 让接收方在反序列化 body 前就知道使用 JSON 还是 Protobuf。
- `messageType` 支持快速校验消息类型。
- `flags` 支持压缩等扩展能力。
- `bodyLength` 解决 TCP 字节流没有消息边界的问题。

## 为什么 TCP 需要处理粘包和半包

TCP 是字节流协议，不保留应用层消息边界。

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

所以 RPC 协议层必须自己定义消息边界。本项目通过：

```text
自定义 header bodyLength
BufferQueue
RpcCodec 循环解码
```

处理粘包和半包。

## 序列化与压缩

框架通过统一接口解耦序列化实现：

```ts
interface Serializer {
  readonly name: "json" | "protobuf";
  serialize(message: RpcMessage): Buffer;
  deserialize(buffer: Buffer): RpcMessage;
}
```

当前支持：

- `JsonSerializer`
- `ProtobufSerializer`

压缩通过 `Compressor` 接口扩展：

```ts
interface Compressor {
  readonly name: string;
  compress(payload: Buffer): Buffer;
  decompress(payload: Buffer): Buffer;
}
```

当前支持：

- `GzipCompressor`

配置示例：

```ts
const compression = {
  compressor: new GzipCompressor(),
  thresholdBytes: 1024,
};
```

小 body 不压缩，大 body 超过阈值后压缩，并在 packet header 的 flags 位标记。

## 消息大小治理

框架支持双重大小限制：

```text
maxBodyLength
maxDecompressedBodyLength
```

意义：

- 编码前限制原始序列化 body，避免主动发送超大消息。
- 解压后再次限制 body，防止压缩炸弹导致内存风险。
- 默认限制使用 `MAX_PACKET_LENGTH = 16MB`。

## 客户端调用链路

一次 `client.call("UserService", "getUser", [1])` 的流程：

```text
RpcClient 创建 RpcRequest
-> 生成 requestId 和 traceId
-> Direct 或 Discovery 选择 endpoint
-> 获取 endpoint 对应 RpcConnectionPool
-> 获取或创建 RpcConnection
-> RpcCodec 序列化、压缩、编码 packet
-> RpcConnection 注册 pending Promise
-> socket.write(packet)
-> 服务端执行方法并返回 RpcResponse
-> 客户端 RpcConnection 解码 response
-> 根据 response.id 找到 pending
-> resolve(result) 或 reject(RpcError)
-> 记录 metrics 和结构化日志
```

## Direct 与 Discovery

Direct 模式：

```ts
const client = new RpcClient({
  mode: "direct",
  host: "127.0.0.1",
  port: 4000,
});
```

适合本地开发、单节点调试和明确目标节点的场景。

Discovery 模式：

```ts
const client = new RpcClient({
  mode: "discovery",
  registry,
  loadBalancer,
});
```

适合多实例服务、负载均衡和故障转移。

## 服务发现与负载均衡

核心抽象：

```ts
interface Registry {
  lookup(serviceName: string): Endpoint[];
}

interface LoadBalancer {
  select(serviceName: string, endpoints: Endpoint[]): Endpoint;
}
```

当前实现：

- `StaticRegistry`
- `RoundRobinLoadBalancer`
- `RandomLoadBalancer`
- `WeightedRoundRobinLoadBalancer`
- `LeastActiveLoadBalancer`

## 重试与 Failover

Discovery 模式下，如果当前 endpoint 失败，客户端会交给 `RetryPolicy` 判断是否可以重试。

默认可重试错误包括：

```text
CONNECTION_CLOSED
CONNECTION_NOT_OPEN
CONNECTION_NOT_CONNECTED
RPC_TIMEOUT
HEARTBEAT_TIMEOUT
SERVER_DRAINING
ECONNREFUSED
ECONNRESET
ETIMEDOUT
EPIPE
```

不可重试错误通常是业务语义错误，例如：

```text
METHOD_NOT_FOUND
SERVICE_NOT_FOUND
INTERNAL_ERROR
```

因为网络类错误说明“节点可能有问题”，可以换节点；业务类错误说明“请求本身可能有问题”，换节点通常没有意义。

## 连接池

客户端按 endpoint 维护连接池：

```text
127.0.0.1:4001 -> RpcConnectionPool -> [conn1, conn2]
127.0.0.1:4002 -> RpcConnectionPool -> [conn1, conn2]
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

连接池的价值：

- 复用 TCP 长连接。
- 减少频繁建连开销。
- 限制单 endpoint 连接数。
- 提升并发吞吐。

## 服务端生命周期与优雅关闭

服务端状态：

```ts
type RpcServerState = "idle" | "listening" | "draining" | "closed";
```

优雅关闭：

```ts
await server.close({
  graceful: true,
  timeoutMs: 3000,
});
```

流程：

```text
停止接受新 TCP 连接
进入 draining
等待 activeRequests 归零
draining 期间拒绝已有连接上的新 request
返回 SERVER_DRAINING
超过 timeoutMs 后强制关闭 socket
进入 closed
```

Discovery client 收到 `SERVER_DRAINING` 后会自动 failover 到其他 endpoint。

## 可观测性

客户端 metrics：

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
    lastErrorCode: "RPC_TIMEOUT"
  }
}
```

连接状态：

```ts
client.getConnectionStats();
```

服务端状态：

```ts
server.getState();
```

结构化日志支持：

- 客户端成功调用。
- 客户端失败调用。
- 客户端限流。
- 客户端熔断。
- Discovery 重试。
- 服务端成功请求。
- 服务端失败请求。
- 服务端非法 socket。

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
    |   |-- src/
    |       |-- buffer-queue.ts
    |       |-- codec.ts
    |       |-- compressor.ts
    |       |-- constants.ts
    |       |-- packet.ts
    |       |-- protobuf-serializer.ts
    |       |-- serializer.ts
    |       |-- types.ts
    |
    |-- core/
    |   |-- src/
    |       |-- client/
    |       |   |-- connection.ts
    |       |   |-- connection-pool.ts
    |       |   |-- proxy.ts
    |       |   |-- retry-policy.ts
    |       |   |-- rpc-client.ts
    |       |-- discovery/
    |       |   |-- static-registry.ts
    |       |   |-- round-robin-load-balancer.ts
    |       |   |-- random-load-balancer.ts
    |       |   |-- weighted-round-robin-load-balancer.ts
    |       |   |-- least-active-load-balancer.ts
    |       |-- server/
    |           |-- rpc-server.ts
    |           |-- service-registry.ts
    |           |-- method-invoker.ts
    |
    |-- example/
        |-- src/
            |-- share/
            |   |-- user-service.ts
            |-- server.ts
            |-- client.ts
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

运行测试：

```bash
pnpm.cmd --filter @weisley-rpc/protocol test
pnpm.cmd --filter @weisley-rpc/core test
```

完整构建：

```bash
pnpm.cmd run build
```

## Example 展示能力

当前 example 使用：

- Protobuf 序列化。
- Gzip 压缩。
- 1KB 压缩阈值。
- body 大小限制。
- 心跳。
- 类型安全 Proxy。
- 服务端 graceful shutdown。

核心配置：

```ts
serializer: new ProtobufSerializer(),
compression: {
  compressor: new GzipCompressor(),
  thresholdBytes: 1024,
},
maxBodyLength: 1024 * 1024,
maxDecompressedBodyLength: 1024 * 1024,
```

## 测试覆盖重点

当前测试覆盖：

- JSON / Protobuf 序列化。
- packet header 编码和解码。
- magic/version/serializer/messageType 校验。
- TCP 粘包和半包。
- Gzip 压缩和解压。
- 压缩前/解压后大小限制。
- 服务注册和方法调用。
- TCP RPC 请求响应。
- 心跳 ping/pong。
- 坏 packet 隔离。
- 请求超时。
- 连接关闭 pending 清理。
- 自动重连。
- Direct / Discovery。
- RoundRobin / Random / WeightedRoundRobin / LeastActive。
- Discovery Failover。
- RetryPolicy 和 RetryContext。
- 熔断器。
- 限流器。
- 连接池和并发 connect 去重。
- Metrics。
- trace 日志。
- graceful shutdown。
- draining 状态和 SERVER_DRAINING failover。

## 面试可讲点

### 1. TCP 为什么会粘包和半包

TCP 是字节流，不保留应用层消息边界，所以需要自定义 header 中的 bodyLength 来切分消息。

### 2. 为什么需要 requestId

同一条 TCP 长连接可以同时承载多个 RPC 请求，响应返回顺序不一定等于请求发送顺序，所以要用 requestId 匹配 pending Promise。

### 3. 为什么 serializerId 放在 header

接收端必须在反序列化 body 之前知道使用 JSON 还是 Protobuf，所以 serializerId 应该下沉到 packet header，而不是放在 body 里。

### 4. 为什么要压缩前和解压后双重限制

只限制压缩后的 packet 不够安全，因为压缩包可能很小，解压后可能很大，形成压缩炸弹风险。

### 5. 为什么 failover 不能重试所有错误

网络类错误说明节点可能不可用，可以换节点；业务语义错误说明请求本身可能有问题，换节点通常没有意义。

### 6. 为什么服务端需要 draining

服务发布、下线或重启时，不能直接切断正在处理的请求。draining 状态可以等待存量请求完成，同时拒绝新请求，让客户端 failover 到其他节点。

## 简历表达建议

基础版：

```text
手写基于 Node.js + TypeScript 的轻量级 RPC 框架，基于 TCP 字节流设计自定义二进制协议，实现粘包/半包处理、请求响应匹配、服务注册、远程方法调用、心跳检测和超时控制。
```

增强版：

```text
设计可演进 RPC 协议头，包含 magic/version/serializerId/messageType/flags/bodyLength，支持 JSON/Protobuf 可插拔序列化、Gzip 阈值压缩、压缩前与解压后双重大小限制，提升协议扩展性和安全性。
```

服务治理版：

```text
实现客户端服务发现与容错治理，支持 Direct/Discovery 模式、连接池、RoundRobin/Weighted/LeastActive 负载均衡、RetryPolicy、指数退避、熔断、限流和 SERVER_DRAINING 自动 failover。
```

生命周期版：

```text
实现服务端生命周期治理，支持 listening/draining/closed 状态切换、优雅关闭、存量请求 drain、新请求拒绝和客户端 failover，模拟生产环境服务下线场景。
```

## Benchmark 压测

当前项目已经包含独立的 `packages/benchmark` 包，用来对 RPC 框架的关键性能维度做可重复压测。

当前覆盖的场景：

```text
JSON vs Protobuf       对比不同序列化方式在 small / medium / large payload 下的吞吐和延迟
Gzip compression       对比开启 gzip 和不开启压缩的性能差异
Connection pool        对比 maxConnectionsPerEndpoint = 1 / 2 / 4
Discovery failover     对比健康 discovery 调用和单节点故障后的 failover 调用
```

运行方式：

```bash
pnpm.cmd bench
```

也可以只运行 benchmark 包：

```bash
pnpm.cmd --filter @weisley-rpc/benchmark build
pnpm.cmd --filter @weisley-rpc/benchmark bench
```

报告输出位置：

```text
packages/benchmark/reports/rpc-benchmark.md
```

压测方法：

```text
每个 case 运行 3 轮
最终结果按 median QPS 取中位数
报告保留每轮 Round Details
QPS 只基于成功请求计算
延迟在客户端侧围绕一次 RPC call 统计
```

结果解读注意点：

- 当前 benchmark 运行在本机 loopback 环境，gzip 的网络传输收益不明显，所以压缩结果更偏向体现 CPU 开销。
- 当前 Protobuf serializer 使用 typed protobuf envelope，但 params/result 内部仍有 JSON 编码成本，因此不是纯 schema-level Protobuf 对比。
- failover benchmark 使用低并发，用来隔离单次调用链路上的故障切换开销，不代表并发故障风暴场景。

## 后续优化方向

- 新增 `packages/benchmark`，测试 QPS、P95/P99 延迟、JSON vs Protobuf、压缩 vs 不压缩、连接池大小影响。
- 实现动态注册中心 `DynamicRegistry`，再扩展 Nacos / Etcd / Consul adapter。
- 支持多 serializer 同时注册，让服务端可以同时接收 JSON 和 Protobuf。
- 增加拦截器 interceptor，支持鉴权、日志、trace、metrics 插件化。
- 增加 IDL 或 schema 校验，提升跨语言契约能力。
- 基于本 RPC 框架构建多 Agent 协作应用，展示分布式应用基座价值。

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
