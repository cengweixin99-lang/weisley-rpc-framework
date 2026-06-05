import { createServer, type Socket } from "node:net";
import { describe, expect, it } from "vitest";
import { RoundRobinLoadBalancer } from "../discovery/round-robin-load-balancer.js";
import { StaticRegistry } from "../discovery/static-registry.js";
import { RpcServer } from "../server/rpc-server.js";
import { RpcClient } from "./rpc-client.js";

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

async function closeNodeServer(server: ReturnType<typeof createServer>): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

function getServerPort(server: RpcServer): number {
  const address = server.address();
  if (!address) {
    throw new Error("Server address is not available");
  }

  return address.port;
}

describe("RpcClient", () => {
  it("tracks connection state across connect and close", async () => {
    const server = new RpcServer();
    await server.listen({ host: "127.0.0.1", port: 0 });

    const client = new RpcClient({
      mode: "direct",
      host: "127.0.0.1",
      port: getServerPort(server),
      timeoutMs: 1000,
    });

    expect(client.getConnectionState()).toBe("idle");

    await client.connect();

    expect(client.getConnectionState()).toBe("connected");

    client.close();

    expect(client.getConnectionState()).toBe("closed");

    await server.close();
  });

  it("calls a remote service method", async () => {
    const server = new RpcServer();

    server.registerService("UserService", {
      async getUser(id: number) {
        return { id, name: "Alice" };
      },
    });

    await server.listen({ host: "127.0.0.1", port: 0 });

    const client = new RpcClient({
      mode: "direct",
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
      mode: "direct",
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
      mode: "direct",
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
      mode: "direct",
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
      mode: "direct",
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
  });

  it("rejects pending request when heartbeat times out", async () => {
    const { server, port, sockets } = await listenSilentServer();

    const client = new RpcClient({
      mode: "direct",
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

    await closeNodeServer(server);
  });

  it("does not reconnect after manual close", async () => {
    const server = new RpcServer();
    await server.listen({ host: "127.0.0.1", port: 0 });

    const client = new RpcClient({
      mode: "direct",
      host: "127.0.0.1",
      port: getServerPort(server),
      timeoutMs: 1000,
      reconnectInitialDelayMs: 10,
      reconnectMaxDelayMs: 20,
    });

    await client.connect();

    expect(client.getConnectionState()).toBe("connected");

    client.close();

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(client.getConnectionState()).toBe("closed");

    await server.close();
  });

  it("enters reconnecting when connection is closed unexpectedly", async () => {
    const server = new RpcServer();
    await server.listen({ host: "127.0.0.1", port: 0 });

    const client = new RpcClient({
      mode: "direct",
      host: "127.0.0.1",
      port: getServerPort(server),
      timeoutMs: 1000,
      reconnectInitialDelayMs: 50,
      reconnectMaxDelayMs: 50,
    });

    await client.connect();

    expect(client.getConnectionState()).toBe("connected");

    server.closeConnections();

    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(client.getConnectionState()).toBe("reconnecting");

    client.close();
    await server.close();
  });

  it("reconnects when server comes back on the same port", async () => {
    const server1 = new RpcServer();

    server1.registerService("UserService", {
      async getUser(id: number) {
        return { id, name: "Alice" };
      },
    });

    await server1.listen({ host: "127.0.0.1", port: 0 });
    const port = getServerPort(server1);

    const client = new RpcClient({
      mode: "direct",
      host: "127.0.0.1",
      port,
      timeoutMs: 1000,
      reconnectInitialDelayMs: 20,
      reconnectMaxDelayMs: 20,
    });

    await client.connect();

    expect(client.getConnectionState()).toBe("connected");

    server1.closeConnections();
    await server1.close();

    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(client.getConnectionState()).toBe("reconnecting");

    const server2 = new RpcServer();

    server2.registerService("UserService", {
      async getUser(id: number) {
        return { id, name: "Bob" };
      },
    });

    await server2.listen({ host: "127.0.0.1", port });

    await new Promise((resolve) => setTimeout(resolve, 80));

    expect(client.getConnectionState()).toBe("connected");

    const result = await client.call("UserService", "getUser", [1]);

    expect(result).toEqual({ id: 1, name: "Bob" });

    client.close();
    await server2.close();
  });

  it("load balances discovery calls with round robin", async () => {
    const server1 = new RpcServer();
    const server2 = new RpcServer();

    server1.registerService("UserService", {
      async getUser(id: number) {
        return { id, name: "Alice" };
      },
    });

    server2.registerService("UserService", {
      async getUser(id: number) {
        return { id, name: "Bob" };
      },
    });

    await server1.listen({ host: "127.0.0.1", port: 0 });
    await server2.listen({ host: "127.0.0.1", port: 0 });

    const client = new RpcClient({
      mode: "discovery",
      registry: new StaticRegistry({
        UserService: [
          { host: "127.0.0.1", port: getServerPort(server1) },
          { host: "127.0.0.1", port: getServerPort(server2) },
        ],
      }),
      loadBalancer: new RoundRobinLoadBalancer(),
      timeoutMs: 1000,
    });

    const first = await client.call("UserService", "getUser", [1]);
    const second = await client.call("UserService", "getUser", [1]);
    const third = await client.call("UserService", "getUser", [1]);

    expect(first).toEqual({ id: 1, name: "Alice" });
    expect(second).toEqual({ id: 1, name: "Bob" });
    expect(third).toEqual({ id: 1, name: "Alice" });

    client.close();
    await server1.close();
    await server2.close();
  });

  it("fails over to next endpoint when selected endpoint is unavailable", async () => {
    const server = new RpcServer();

    server.registerService("UserService", {
      async getUser(id: number) {
        return { id, name: "Bob" };
      },
    });

    await server.listen({ host: "127.0.0.1", port: 0 });

    const badPort = getServerPort(server) + 10000;

    const client = new RpcClient({
      mode: "discovery",
      registry: new StaticRegistry({
        UserService: [
          { host: "127.0.0.1", port: badPort },
          { host: "127.0.0.1", port: getServerPort(server) },
        ],
      }),
      loadBalancer: new RoundRobinLoadBalancer(),
      timeoutMs: 100,
      reconnect: false,
    });

    const result = await client.call("UserService", "getUser", [1]);

    expect(result).toEqual({ id: 1, name: "Bob" });

    client.close();
    await server.close();
  });
});
