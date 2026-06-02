import { describe, expect, it } from "vitest";
import { RpcServer } from "../server/rpc-server.js";
import { RpcClient } from "./rpc-client.js";
import { createServer, type AddressInfo, type Socket } from "node:net";

async function listenSilentServer(): Promise<{
  server: ReturnType<typeof createServer>;
  sockets: Set<Socket>;
  port: number;
}> {
    const sockets = new Set<Socket>();

    const server = createServer((socket) => {
      sockets.add(socket);

      socket.on("close", () => {
        sockets.delete(socket);
      });

      socket.on("data", () => {
      // Intentionally ignore all data, including heartbeat ping.
      });
    });
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });

    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Silent server address is not available");
    }

    return {
      server,
      sockets,
      port: address.port,
    };
}

function getServerPort(server: RpcServer): number {
  const address = server.address();
  if (!address) {
    throw new Error("Server address is not available");
  }
  return address.port;
}

describe("RpcClient", () => {
  it("calls a remote service method", async () => {
    const server = new RpcServer();

    server.registerService("UserService", {
      async getUser(id: number) {
        return { id, name: "Alice" };
      },
    });

    await server.listen({ host: "127.0.0.1", port: 0 });

    const client = new RpcClient({
      host: "127.0.0.1",
      port: getServerPort(server),
      timeoutMs: 1000,
    });

    await client.connect();

    const result = await client.call("UserService", "getUser", [1]);

    expect(result).toEqual({ id: 1, name: "Alice" });

    client.close();
    await server.close();
  });
  
  it("rejects when server returns an RPC error", async () => {
    const server = new RpcServer();

    server.registerService("UserService", {
      async getUser(id: number) {
        return { id, name: "Alice" };
      },
    });

    
    await server.listen({ host: "127.0.0.1", port: 0 });

    const client = new RpcClient({
      host: "127.0.0.1",
      port: getServerPort(server),
      timeoutMs: 1000,
    });

    await client.connect();

    await expect(client.call("UserService", "missingMethod", [])).rejects.toMatchObject({
      code: "METHOD_NOT_FOUND",
    });

    client.close();
    await server.close();
  });

  it("rejects when request times out", async () => {
    const server = new RpcServer();

    server.registerService("SlowService", {
      async wait() {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return "done";
      },
    });

    await server.listen({ host: "127.0.0.1", port: 0 });

    const client = new RpcClient({
      host: "127.0.0.1",
      port: getServerPort(server),
      timeoutMs: 10,
    });

    await client.connect();

    await expect(client.call("SlowService", "wait", [])).rejects.toMatchObject({
      code: "RPC_TIMEOUT",
    });

    client.close();
    await server.close();
  });

  it("rejects pending request when connection closes", async () => {
    const server = new RpcServer();
    server.registerService("SlowService", {
      async wait() {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return "done";
      },
    });

    await server.listen({ host: "127.0.0.1", port: 0 });

    const client = new RpcClient({
      host: "127.0.0.1",
      port: getServerPort(server),
      timeoutMs: 1000,
    });

    await client.connect();

    const pendingCall = client.call("SlowService", "wait", []);
    client.close();
    await expect(pendingCall).rejects.toMatchObject({
      code: "CONNECTION_CLOSED",
    });
    await server.close();
  });

  it("keeps normal calls working when heartbeat is enabled", async () => {
    const server = new RpcServer();
    server.registerService("UserService", {
      async getUser(id: number) {
        return { id, name: "Alice" };
      },
    });

    await server.listen({ host: "127.0.0.1", port: 0 });

    const client = new RpcClient({
      host: "127.0.0.1",
      port: getServerPort(server),
      timeoutMs: 1000,
      heartbeatIntervalMs: 10,
      heartbeatTimeoutMs: 50,
    });

    await client.connect();

    await new Promise((resolve) => setTimeout(resolve, 30));
    const result = await client.call("UserService", "getUser", [1]);

    expect(result).toEqual({ id: 1, name: "Alice" });

    client.close();
    await server.close();
  })

  it("rejects pending request when heartbeat times out", async () => {
    const { server, port, sockets } = await listenSilentServer();

    const client = new RpcClient({
      host: "127.0.0.1",
      port,
      timeoutMs: 1000,
      heartbeatIntervalMs: 10,
      heartbeatTimeoutMs: 30,
    });

    await client.connect();

    const pendingCall = client.call("UserService", "getUser", [1]);

    await expect(pendingCall).rejects.toMatchObject({
      code: "HEARTBEAT_TIMEOUT",
    });

    client.close();
    for (const socket of sockets) {
        socket.destroy();
    }
    await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });
    });
});
