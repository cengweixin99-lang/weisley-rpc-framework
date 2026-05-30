import { describe, expect, it } from "vitest";
import { RpcServer } from "../server/rpc-server.js";
import { RpcClient } from "./rpc-client.js";

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

});
