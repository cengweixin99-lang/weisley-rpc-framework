# Weisley RPC Framework

A lightweight RPC framework built from scratch with Node.js and TypeScript. The goal is not to clone gRPC or Dubbo, but to understand the core mechanics of RPC by implementing a small, working framework: protocol encoding, TCP transport, service registration, remote invocation, request/response matching, timeout handling, type-safe proxy calls, connection cleanup, and heartbeat detection.

## What Is RPC?

RPC means Remote Procedure Call. It lets a client call a function running in another process, often on another machine, while keeping the call site close to normal method syntax.

HTTP API style usually looks like:

```text
GET /users/1
POST /orders
```

RPC style looks more like:

```text
UserService.getUser(1)
OrderService.createOrder(payload)
```

The local call is not magic. The framework converts it into a network message, sends it to the server, invokes the target service method, then sends the result back.

## Existing RPC Products

### gRPC

gRPC is a modern RPC framework from Google. It commonly uses Protocol Buffers as the interface definition and serialization format, runs on HTTP/2, supports multiple languages, and includes features such as streaming, deadlines, cancellation, and authentication.

### Apache Dubbo

Dubbo focuses heavily on service governance. Besides RPC calls, it provides service discovery, load balancing, routing, traffic governance, configuration, observability, and authorization features. It is especially common in Java microservice ecosystems.

### Apache Thrift

Thrift uses an IDL and code generation model. Developers define service contracts first, then generate client and server code for different languages. It is useful when multiple languages need a shared service contract.

### tRPC

tRPC is a TypeScript-first RPC framework that emphasizes end-to-end type safety. It is excellent for full-stack TypeScript projects where server and client can share types.

## Project Positioning

This project borrows ideas from those systems, but keeps the first version intentionally small:

```text
Type sharing: TypeScript service interfaces, similar in spirit to tRPC
Protocol layering: explicit message and codec design
Service registration: local service registry on the server
TCP transport: length-prefixed JSON messages over TCP
Reliability basics: timeout, connection close cleanup, heartbeat ping/pong
```

## How The RPC Flow Works

One remote call goes through this path:

```text
1. Client calls userService.getUser(1)
2. Proxy converts it to client.call("UserService", "getUser", [1])
3. RpcClient builds an RpcRequest with a unique request id
4. JsonSerializer converts the message to a Buffer
5. RpcCodec wraps the body with a 4-byte length header
6. RpcConnection writes the packet to a TCP socket
7. RpcServer decodes the packet back into an RpcRequest
8. MethodInvoker finds and executes the local service method
9. Server wraps the result as an RpcResponse
10. Client receives the response and resolves the pending Promise by response.id
```

The core idea is:

```text
local proxy call
  -> protocol encoding
  -> TCP transport
  -> server-side method invocation
  -> response matching
```

## Protocol

The protocol uses length-prefixed JSON messages:

```text
[4 bytes body length][JSON body]
```

The current message model is:

```ts
type RpcMessage = RpcRequest | RpcResponse | RpcPing | RpcPong;
```

Message types:

```text
request   business request from client to server
response  business response from server to client
ping      heartbeat message from client to server
pong      heartbeat response from server to client
```

Using a `type` field makes the protocol easier to extend later with messages such as `cancel`, `stream`, or `metadata`.

## Implementation Modules

`packages/protocol` contains the low-level protocol:

```text
types.ts          protocol message models
serializer.ts     RpcMessage <-> JSON Buffer
packet.ts         body Buffer <-> length-prefixed packet
buffer-queue.ts   TCP chunk cache for sticky/split packets
codec.ts          combines serializer, packet, and BufferQueue
```

`packages/core` contains the RPC runtime:

```text
server/service-registry.ts   local service table
server/method-invoker.ts     RpcRequest -> local method -> RpcResponse
server/rpc-server.ts         TCP server, request dispatch, ping/pong handling
client/connection.ts         TCP client, pending map, timeout, heartbeat
client/rpc-client.ts         public client API
client/proxy.ts              type-safe proxy wrapper
```

`packages/example` contains an end-to-end demo with a shared TypeScript service interface.

## Reliability Features

The current implementation includes:

```text
Request timeout with RpcTimeoutError
Server-side error wrapping
Connection close cleanup for pending requests
Invalid packet isolation on server sockets
Dynamic test ports using port: 0
Heartbeat ping/pong with HEARTBEAT_TIMEOUT
```

Heartbeat behavior:

```text
Client sends ping at heartbeatIntervalMs
Server responds with pong
Client updates lastPongAt when pong arrives
If no pong arrives within heartbeatTimeoutMs, the connection is destroyed and pending calls are rejected
```

## First Week Roadmap

### Day 1: Protocol Layer

Built protocol types, JSON serializer, length-prefixed packet encoding, BufferQueue, and RpcCodec.

Acceptance:

```text
RpcMessage can be encoded into a TCP packet
Complete packets can be decoded
Split packets and sticky packets are handled
```

### Day 2: Server Runtime

Built ServiceRegistry, MethodInvoker, and RpcServer.

Acceptance:

```text
Server can register UserService
Server can receive an RpcRequest over TCP
Server can invoke local service methods and return RpcResponse
```

### Day 3: Client Runtime

Built RpcClient and RpcConnection.

Acceptance:

```text
client.call("UserService", "getUser", [1]) returns the remote result
Client rejects server errors
Client rejects timed-out requests
Client rejects pending requests when connection closes
```

### Day 4: Type-Safe Proxy

Built `createProxy<T>()`.

Acceptance:

```ts
const userService = client.createProxy<UserService>("UserService");
await userService.getUser(1);
```

The IDE can infer method names, parameter types, and return types.

### Day 5: Stability

Added dynamic test ports, connection cleanup tests, invalid packet handling, and bad-connection isolation.

Acceptance:

```text
Bad protocol data closes only the bad socket
Server keeps serving new connections
Tests do not rely on fixed ports
```

### Day 6: Heartbeat

Upgraded protocol messages with `type`, added `ping/pong`, and implemented client heartbeat timeout detection.

Acceptance:

```text
Server returns pong for ping
Heartbeat does not affect normal RPC calls
Missing pong triggers HEARTBEAT_TIMEOUT
```

### Day 7: Documentation And Demo

Updated the README, cleaned protocol definitions, and kept the example aligned with current framework capabilities.

## Project Structure

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

## Quick Start

Install dependencies:

```bash
pnpm.cmd install
```

Build:

```bash
pnpm.cmd run build
```

Start the server:

```bash
pnpm.cmd dev:server
```

In another terminal, start the client:

```bash
pnpm.cmd dev:client
```

Expected client output:

```text
{ id: 1, name: 'Alice' }
[
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' }
]
```

## Useful Commands

```bash
pnpm.cmd --filter @weisley-rpc/protocol test
pnpm.cmd --filter @weisley-rpc/core test
pnpm.cmd run build
```

## References

- [gRPC Introduction](https://grpc.io/docs/what-is-grpc/introduction/)
- [Apache Dubbo Overview](https://dubbo.apache.org/en/overview/what/)
- [Apache Thrift](https://thrift.apache.org/)
- [tRPC](https://trpc.io/)
