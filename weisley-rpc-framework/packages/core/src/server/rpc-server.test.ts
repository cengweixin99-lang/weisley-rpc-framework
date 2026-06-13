import { Socket } from "node:net";
import { describe, expect, it } from "vitest";
import {
  HEADER_LENGTH,
  MAGIC_NUMBER,
  PROTOCOL_VERSION,
  RpcCodec,
  SERIALIZER_IDS,
  MESSAGE_TYPE_IDS,
  type RpcPong,
  type RpcResponse,
} from "@weisley-rpc/protocol";
import { RpcServer } from "./rpc-server.js";
import { RpcClient } from "../client/rpc-client.js";

function createTestLogger() {
  return {
    infos: [] as Array<{ message: string; fields?: Record<string, unknown> | undefined }>,
    warns: [] as Array<{ message: string; fields?: Record<string, unknown> | undefined }>,
    errors: [] as Array<{ message: string; fields?: Record<string, unknown> | undefined}>,

    info(message: string, fields?: Record<string, unknown>) {
      this.infos.push({ message, fields });
    },

    warn(message: string, fields?: Record<string, unknown>) {
      this.warns.push({ message, fields });
    },

    error(message: string, fields?: Record<string, unknown>) {
      this.errors.push({ message, fields });
    },
  };
}

function getServerPort(server: RpcServer): number {
  const address = server.address();
  if (!address) {
    throw new Error("Server address is not available");
  }
  return address.port;
}

async function connectSocket(port: number): Promise<Socket> {
  const socket = new Socket();
  await new Promise<void>((resolve, reject) => {
    socket.once("error", reject);
    socket.connect(port, "127.0.0.1", resolve);
  });
  return socket;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createProtocolHeader(options: {
  magic: number;
  version: number;
}): Buffer {
  const header = Buffer.allocUnsafe(HEADER_LENGTH);
  header.writeUInt16BE(options.magic, 0);
  header.writeUInt8(options.version, 2);
  header.writeUInt8(SERIALIZER_IDS.json, 3);
  header.writeUInt8(MESSAGE_TYPE_IDS.request, 4);
  header.writeUInt8(0, 5);
  header.writeUInt32BE(0, 6);
  return header;
}
describe("RpcServer", () => {
  it("tracks server lifecycle state", async () => {
    const server = new RpcServer();

    expect(server.getState()).toBe("idle");

    await server.listen({ host: "127.0.0.1", port: 0 });
    expect(server.getState()).toBe("listening");

    await server.close();
    expect(server.getState()).toBe("closed");
  });

  it("handles one RPC request over TCP", async () => {
    // 创建 RPC 服务端
    const server = new RpcServer();
    // 注册一个本地服务
    server.registerService("UserService", {
      async getUser(id: number) {
        return { id, name: "Alice" };
      },
    });
    // 启动 TCP 服务，监听本机 `4100` 端口
    await server.listen({ host: "127.0.0.1", port: 0 });
    const address = server.address();
    if (!address) {
      throw new Error("Server address is not available");
    }

    // 创建一个原始 TCP 客户端 socket，codec 用来在测试里手动编码请求、解码响应
    const socket = new Socket();
    const codec = new RpcCodec();

    // 连接 RPC 服务端
    await new Promise<void>((resolve, reject) => {
      socket.once("error", reject);
      socket.connect(address.port, "127.0.0.1", resolve);
    });
    // 等服务端响应，当 TCP 收到数据时，会触发 socket.on("data",...)
    const responsePromise = new Promise<RpcResponse>((resolve, reject) => {
      socket.once("error", reject);
      socket.on("data", (chunk) => {
        const messages = codec.push(chunk) as RpcResponse[];
        const response = messages[0];

        if (response) {
          resolve(response);
        }
      });
    });

    socket.write(
      codec.encode({
        type: "request",
        id: "req-1",
        service: "UserService",
        method: "getUser",
        params: [1],
      }),
    );

    const response = await responsePromise;

    expect(response).toEqual({
      type: "response",
      id: "req-1",
      ok: true,
      result: { id: 1, name: "Alice" },
    });

    socket.end();
    await server.close();
  });

  it("closes socket when packet magic is invalid", async () => {
    const server = new RpcServer();
    await server.listen({ host: "127.0.0.1", port: 0 });

    const address = server.address();
    if (!address) {
      throw new Error("Server address is not available");
    }

    const socket = new Socket();
    await new Promise<void>((resolve, reject) => {
      socket.once("error", reject);
      socket.connect(address.port, "127.0.0.1", resolve);
    });
    const closedPromise = new Promise<void>((resolve) => {
      socket.once("close", () => resolve());
    });
    const invalidHeader = createProtocolHeader({
      magic: 0xbeef,
      version: PROTOCOL_VERSION,
    });
    socket.write(invalidHeader);

    await closedPromise;
    await server.close();
  });

  it("keeps server alive after closing invalid protocol socket", async () => {
    const server = new RpcServer();
    server.registerService("UserService", {
      async getUser(id: number) {
        return { id, name: "Alice" };
      },
    });
    await server.listen({ host: "127.0.0.1", port: 0 });
    const port = getServerPort(server);

    const invalidSocket = await connectSocket(port);
    const invalidSocketClosed = new Promise<void>((resolve) => {
      invalidSocket.once("close", () => resolve());
    });
    const invalidHeader = createProtocolHeader({
      magic: MAGIC_NUMBER,
      version: PROTOCOL_VERSION + 1,
    });
    invalidSocket.write(invalidHeader);
    await invalidSocketClosed;

    const validSocket = await connectSocket(port);
    const codec = new RpcCodec();
    const responsePromise = new Promise<RpcResponse>((resolve, reject) => {
      validSocket.once("error", reject);
      validSocket.on("data", (chunk) => {
        const messages = codec.push(chunk) as RpcResponse[];
        const response = messages[0];
        if (response) {
          resolve(response);
        }
      });
    });
    validSocket.write(
      codec.encode({
        type: "request",
        id: "req-1",
        service: "UserService",
        method: "getUser",
        params: [1],
      }),
    );
    const response = await responsePromise;
    expect(response).toEqual({
      type: "response",
      id: "req-1",
      ok: true,
      result: { id: 1, name: "Alice" },
    });
    validSocket.end();
    await server.close();
  });
  it("returns pong for ping message", async () => {
    const server = new RpcServer();

    await server.listen({ host: "127.0.0.1", port: 0 });
    const port = getServerPort(server);

    const socket = await connectSocket(port);
    const codec = new RpcCodec();

    const pongPromise = new Promise<RpcPong>((resolve, reject) => {
      socket.once("error", reject);
      socket.on("data", (chunk) => {
        const messages = codec.push(chunk);
        const pong = messages.find((message) => message.type === "pong");

        if (pong) {
          resolve(pong);
        }
      });
    });

    socket.write(
      codec.encode({
        type: "ping",
        id: "ping-1",
        timestamp: 123,
      }),
    );

    const pong = await pongPromise;

    expect(pong).toMatchObject({
      type: "pong",
      id: "ping-1",
    });

    expect(pong.timestamp).toEqual(expect.any(Number));

    socket.end();
    await server.close();
  });
  it("logs server successful rpc request", async () => {
    const logger = createTestLogger();
    const server = new RpcServer();

    server.registerService("UserService", {
      async getUser(id: number) {
        return { id, name: "Alice" };
      },
    });

    await server.listen({
      host: "127.0.0.1",
      port: 0,
      logger,
    });

    const client = new RpcClient({
      mode: "direct",
      host: "127.0.0.1",
      port: getServerPort(server),
      timeoutMs: 1000,
    });

    await expect(
      client.call("UserService", "getUser", [1], {
        metadata: {
          traceId: "trace-server-success",
        },
      }),
    ).resolves.toEqual({ id: 1, name: "Alice" });

    expect(logger.infos).toHaveLength(1);
    expect(logger.infos[0]).toMatchObject({
      message: "rpc server request succeeded",
      fields: {
        service: "UserService",
        method: "getUser",
        traceId: "trace-server-success",
        requestId: expect.any(String),
        durationMs: expect.any(Number),
      },
    });

    client.close();
    await server.close();
  });
  it("logs server failed rpc request", async () => {
    const logger = createTestLogger();
    const server = new RpcServer();

    server.registerService("UserService", {
      async getUser(id: number) {
        return { id, name: "Alice" };
      },
    });

    await server.listen({
      host: "127.0.0.1",
      port: 0,
      logger,
    });

    const client = new RpcClient({
      mode: "direct",
      host: "127.0.0.1",
      port: getServerPort(server),
      timeoutMs: 1000,
    });

    await expect(
      client.call("UserService", "missingMethod", [], {
        metadata: {
          traceId: "trace-server-failed",
        },
      }),
    ).rejects.toMatchObject({
      code: "METHOD_NOT_FOUND",
    });

    expect(logger.errors).toHaveLength(1);
    expect(logger.errors[0]).toMatchObject({
      message: "rpc server request failed",
      fields: {
        service: "UserService",
        method: "missingMethod",
        traceId: "trace-server-failed",
        requestId: expect.any(String),
        durationMs: expect.any(Number),
        errorCode: "METHOD_NOT_FOUND",
      },
    });

    client.close();
    await server.close();
  });

  it("waits for active request before graceful close", async () => {
    const server = new RpcServer();
    let releaseRequest!: () => void;
    const requestStarted = new Promise<void>((resolve) => {
      server.registerService("SlowService", {
        async wait() {
          resolve();
          await new Promise<void>((release) => {
            releaseRequest = release;
          });
          return "ok";
        },
      });
    });

    await server.listen({ host: "127.0.0.1", port: 0 });

    const client = new RpcClient({
      mode: "direct",
      host: "127.0.0.1",
      port: getServerPort(server),
      timeoutMs: 1000,
    });

    const callPromise = client.call("SlowService", "wait", []);
    await requestStarted;

    let closeFinished = false;
    const closePromise = server.close({ graceful: true, timeoutMs: 1000 }).then(
      () => {
        closeFinished = true;
      },
    );

    await delay(20);
    expect(closeFinished).toBe(false);

    releaseRequest();

    await expect(callPromise).resolves.toBe("ok");
    await closePromise;
    expect(closeFinished).toBe(true);

    client.close();
  });

  it("rejects new requests while graceful close is draining", async () => {
    const server = new RpcServer();
    let releaseRequest!: () => void;
    let rejectedMethodCalled = false;
    const requestStarted = new Promise<void>((resolve) => {
      server.registerService("SlowService", {
        async wait() {
          resolve();
          await new Promise<void>((release) => {
            releaseRequest = release;
          });
          return "ok";
        },
        async shouldReject() {
          rejectedMethodCalled = true;
          return "should not run";
        },
      });
    });

    await server.listen({ host: "127.0.0.1", port: 0 });

    const client = new RpcClient({
      mode: "direct",
      host: "127.0.0.1",
      port: getServerPort(server),
      timeoutMs: 1000,
    });

    const activeCall = client.call("SlowService", "wait", []);
    await requestStarted;

    const closePromise = server.close({ graceful: true, timeoutMs: 1000 });
    await delay(20);
    expect(server.getState()).toBe("draining");

    await expect(client.call("SlowService", "shouldReject", [])).rejects.toMatchObject({
      code: "SERVER_DRAINING",
    });
    expect(rejectedMethodCalled).toBe(false);

    releaseRequest();
    await expect(activeCall).resolves.toBe("ok");
    await closePromise;
    expect(server.getState()).toBe("closed");

    client.close();
  });

  it("forces close when graceful close timeout is reached", async () => {
    const server = new RpcServer();
    const requestStarted = new Promise<void>((resolve) => {
      server.registerService("SlowService", {
        async waitForever() {
          resolve();
          await new Promise(() => {});
        },
      });
    });

    await server.listen({ host: "127.0.0.1", port: 0 });

    const client = new RpcClient({
      mode: "direct",
      host: "127.0.0.1",
      port: getServerPort(server),
      timeoutMs: 1000,
    });

    const callPromise = client.call("SlowService", "waitForever", []);
    await requestStarted;

    await server.close({ graceful: true, timeoutMs: 20 });

    await expect(callPromise).rejects.toMatchObject({
      code: "CONNECTION_CLOSED",
    });

    client.close();
  });
});
