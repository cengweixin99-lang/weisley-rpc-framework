import { Socket } from "node:net";
import { describe, expect, it } from "vitest";
import { HEADER_LENGTH, MAX_PACKET_LENGTH, RpcCodec, type RpcResponse } from "@weisley-rpc/protocol";
import { RpcServer } from "./rpc-server.js";

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
describe("RpcServer", () => {
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
        id: "req-1",
        service: "UserService",
        method: "getUser",
        params: [1],
      }),
    );

    const response = await responsePromise;

    expect(response).toEqual({
      id: "req-1",
      ok: true,
      result: { id: 1, name: "Alice" },
    });

    socket.end();
    await server.close();
  });
  
  it("closes socket when receiving invalid packet", async () => {
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
    const invalidHeader = Buffer.allocUnsafe(HEADER_LENGTH);
    invalidHeader.writeUint32BE(MAX_PACKET_LENGTH + 1, 0);
    socket.write(invalidHeader);

    await closedPromise;
    await server.close();
  });

  it("keeps server alive after closing invalid socket", async () => {
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
    const invalidHeader = Buffer.allocUnsafe(HEADER_LENGTH);
    invalidHeader.writeUint32BE(MAX_PACKET_LENGTH + 1, 0);
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
        id: "req-1",
        service: "UserService",
        method: "getUser",
        params: [1],
      }),
    );
    const response = await responsePromise;
    expect(response).toEqual({
      id: "req-1",
      ok: true,
      result: { id: 1, name: "Alice" },
    });
    validSocket.end();
    await server.close();
  });
});

