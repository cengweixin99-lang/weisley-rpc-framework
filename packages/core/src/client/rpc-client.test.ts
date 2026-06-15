import { createServer, type Socket } from "node:net";
import { describe, expect, it } from "vitest";
import { RoundRobinLoadBalancer } from "../discovery/round-robin-load-balancer.js";
import { StaticRegistry } from "../discovery/static-registry.js";
import { RpcServer } from "../server/rpc-server.js";
import { RpcClient } from "./rpc-client.js";
import { warn } from "node:console";
import { GzipCompressor, ProtobufSerializer } from "@weisley-rpc/protocol";

function createTestLogger() {
  return {
    infos: [] as Array<{
      message: string;
      fields?: Record<string, unknown> | undefined;
    }>,
    warns: [] as Array<{
      message: string;
      fields?: Record<string, unknown> | undefined;
    }>,
    errors: [] as Array<{
      message: string;
      fields?: Record<string, unknown> | undefined;
    }>,
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

async function closeNodeServer(
  server: ReturnType<typeof createServer>,
): Promise<void> {
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

async function getClosedPort(): Promise<number> {
  const server = createServer();

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Temporary server address is not available");
  }

  const port = address.port;
  await closeNodeServer(server);

  return port;
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

    await expect(
      client.call("UserService", "missingMethod", []),
    ).rejects.toMatchObject({
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

    expect(["reconnecting", "connecting"]).toContain(
      client.getConnectionState(),
    );

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

    const badPort = await getClosedPort();

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

  it("fails over when selected endpoint is draining", async () => {
    const server1 = new RpcServer();
    const server2 = new RpcServer();
    let releaseDrainingRequest!: () => void;
    const drainingRequestStarted = new Promise<void>((resolve) => {
      server1.registerService("UserService", {
        async hold() {
          resolve();
          await new Promise<void>((release) => {
            releaseDrainingRequest = release;
          });
          return "released";
        },
        async getUser() {
          return { id: 1, name: "Alice" };
        },
      });
    });

    server2.registerService("UserService", {
      async getUser() {
        return { id: 1, name: "Bob" };
      },
    });

    await server1.listen({ host: "127.0.0.1", port: 0 });
    await server2.listen({ host: "127.0.0.1", port: 0 });
    const server1Port = getServerPort(server1);
    const server2Port = getServerPort(server2);

    const holdClient = new RpcClient({
      mode: "direct",
      host: "127.0.0.1",
      port: server1Port,
      timeoutMs: 1000,
    });
    const holdCall = holdClient.call("UserService", "hold", []);
    await drainingRequestStarted;

    const closePromise = server1.close({ graceful: true, timeoutMs: 1000 });

    const client = new RpcClient({
      mode: "discovery",
      registry: new StaticRegistry({
        UserService: [
          { host: "127.0.0.1", port: server1Port },
          { host: "127.0.0.1", port: server2Port },
        ],
      }),
      loadBalancer: new RoundRobinLoadBalancer(),
      timeoutMs: 1000,
      retryMaxAttempts: 2,
    });

    await expect(client.call("UserService", "getUser", [])).resolves.toEqual({
      id: 1,
      name: "Bob",
    });

    releaseDrainingRequest();
    await expect(holdCall).resolves.toBe("released");
    await closePromise;

    client.close();
    holdClient.close();
    await server2.close();
  });

  it("does not fail over for non-retryable rpc errors", async () => {
    const server1 = new RpcServer();
    const server2 = new RpcServer();
    server1.registerService("UserService", {
      async getUser(id: number) {
        return { id, name: "Alice" };
      },
    });

    server2.registerService("UserService", {
      async missingMethod() {
        return "should not be called";
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

    await expect(
      client.call("UserService", "missingMethod", []),
    ).rejects.toMatchObject({
      code: "METHOD_NOT_FOUND",
    });
    client.close();
    await server1.close();
    await server2.close();
  });

  it("throw last error when all discovered endpoints are unavailable", async () => {
    const client = new RpcClient({
      mode: "discovery",
      registry: new StaticRegistry({
        UserService: [
          { host: "127.0.0.1", port: 65530 },
          { host: "127.0.0.1", port: 65531 },
        ],
      }),
      loadBalancer: new RoundRobinLoadBalancer(),
      timeoutMs: 100,
      reconnect: false,
    });

    await expect(
      client.call("UserService", "getUser", [1]),
    ).rejects.toMatchObject({
      code: "ECONNREFUSED",
    });
    client.close();
  });

  it("rejects when no endpoint is discovered", async () => {
    const client = new RpcClient({
      mode: "discovery",
      registry: new StaticRegistry({}),
      loadBalancer: new RoundRobinLoadBalancer(),
      timeoutMs: 100,
    });

    await expect(client.call("UserService", "getUser", [1])).rejects.toThrow(
      "No available endpoint for service: UserService",
    );

    client.close();
  });

  it("uses custom retry policy in discovery failover", async () => {
    const server1 = new RpcServer();
    const server2 = new RpcServer();

    const retryContexts: unknown[] = [];
    server1.registerService("UserService", {
      async getUser(id: number) {
        return { id, name: "Alice" };
      },
    });

    server2.registerService("UserService", {
      async missingMethod() {
        return "called by custom retry policy";
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
      retryPolicy: {
        shouldRetry(_error, context) {
          retryContexts.push(context);
          return true;
        },
      },
    });

    const result = await client.call("UserService", "missingMethod", []);

    expect(result).toBe("called by custom retry policy");
    expect(retryContexts).toHaveLength(1);
    expect(retryContexts).toEqual([
      {
        serviceName: "UserService",
        method: "missingMethod",
        attempt: 1,
        maxAttempts: 2,
        endpoint: {
          host: "127.0.0.1",
          port: getServerPort(server1),
        },
        errorCode: "METHOD_NOT_FOUND",
      },
    ]);
    client.close();
    await server1.close();
    await server2.close();
  });

  it("shares in-flight connection when calls start concurrently", async () => {
    const server = new RpcServer();

    server.registerService("UserService", {
      async getUser(id: number) {
        return { id, name: `User-${id}` };
      },
    });

    await server.listen({ host: "127.0.0.1", port: 0 });

    const client = new RpcClient({
      mode: "direct",
      host: "127.0.0.1",
      port: getServerPort(server),
      timeoutMs: 1000,
      maxConnectionsPerEndpoint: 1,
    });

    const [first, second] = await Promise.all([
      client.call("UserService", "getUser", [1]),
      client.call("UserService", "getUser", [2]),
    ]);

    expect(first).toEqual({ id: 1, name: "User-1" });
    expect(second).toEqual({ id: 2, name: "User-2" });

    client.close();
    await server.close();
  });

  it("limits tcp connections per endpoint with connection pool", async () => {
    const server = new RpcServer();
    server.registerService("UserService", {
      async getUser(id: number) {
        await new Promise((resolve) => setTimeout(resolve, 20));
        return { id, name: `User-${id}` };
      },
    });
    await server.listen({ host: "127.0.0.1", port: 0 });

    const client = new RpcClient({
      mode: "direct",
      host: "127.0.0.1",
      port: getServerPort(server),
      timeoutMs: 1000,
      maxConnectionsPerEndpoint: 2,
    });
    const results = await Promise.all([
      client.call("UserService", "getUser", [1]),
      client.call("UserService", "getUser", [2]),
      client.call("UserService", "getUser", [3]),
      client.call("UserService", "getUser", [4]),
    ]);

    expect(results).toEqual([
      { id: 1, name: "User-1" },
      { id: 2, name: "User-2" },
      { id: 3, name: "User-3" },
      { id: 4, name: "User-4" },
    ]);

    expect(server.getConnectionCount()).toBeLessThanOrEqual(2);
    client.close();
    await server.close();
  });

  it("maintains separate connection pools for discovered endpoints", async () => {
    const server1 = new RpcServer();
    const server2 = new RpcServer();

    server1.registerService("UserService", {
      async getUser(id: number) {
        await new Promise((resolve) => setTimeout(resolve, 20));
        return { id, name: `Alice-${id}` };
      },
    });

    server2.registerService("UserService", {
      async getUser(id: number) {
        await new Promise((resolve) => setTimeout(resolve, 20));
        return { id, name: `Bob-${id}` };
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
      maxConnectionsPerEndpoint: 1,
    });

    const results = await Promise.all([
      client.call("UserService", "getUser", [1]),
      client.call("UserService", "getUser", [2]),
      client.call("UserService", "getUser", [3]),
      client.call("UserService", "getUser", [4]),
    ]);

    expect(results).toEqual([
      { id: 1, name: "Alice-1" },
      { id: 2, name: "Bob-2" },
      { id: 3, name: "Alice-3" },
      { id: 4, name: "Bob-4" },
    ]);

    expect(server1.getConnectionCount()).toBeLessThanOrEqual(1);
    expect(server2.getConnectionCount()).toBeLessThanOrEqual(1);

    client.close();
    await server1.close();
    await server2.close();
  });

  it("returns connection stats by endpoint", async () => {
    const server = new RpcServer();
    server.registerService("UserService", {
      async getUser(id: number) {
        return { id, name: "Alice" };
      },
    });
    await server.listen({ host: "127.0.0.1", port: 0 });

    const port = getServerPort(server);
    const client = new RpcClient({
      mode: "direct",
      host: "127.0.0.1",
      port,
      timeoutMs: 1000,
      maxConnectionsPerEndpoint: 2,
    });
    await Promise.all([
      client.call("UserService", "getUser", [1]),
      client.call("UserService", "getUser", [2]),
    ]);
    expect(client.getConnectionStats()).toEqual({
      [`127.0.0.1:${port}`]: {
        total: 2,
        states: {
          idle: 0,
          connecting: 0,
          connected: 2,
          reconnecting: 0,
          closed: 0,
        },
      },
    });
    client.close();
    await server.close();
  });

  it("records metrics for successful calls", async () => {
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
    await client.call("UserService", "getUser", [1]);
    await client.call("UserService", "getUser", [2]);

    const metrics = client.getMetrics();
    expect(metrics["UserService.getUser"]?.totalCalls).toBe(2);
    expect(metrics["UserService.getUser"]?.successCalls).toBe(2);
    expect(metrics["UserService.getUser"]?.failedCalls).toBe(0);
    expect(
      metrics["UserService.getUser"]?.averageDurationMs,
    ).toBeGreaterThanOrEqual(0);
    client.close();
    await server.close();
  });

  it("record metrics for failed calls", async () => {
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

    await expect(
      client.call("UserService", "missingMethod", []),
    ).rejects.toMatchObject({
      code: "METHOD_NOT_FOUND",
    });
    const metrics = client.getMetrics();
    expect(metrics["UserService.missingMethod"]).toMatchObject({
      totalCalls: 1,
      successCalls: 0,
      failedCalls: 1,
      lastErrorCode: "METHOD_NOT_FOUND",
    });

    client.close();
    await server.close();
  });

  it("returns an isolated metrics snapshot", async () => {
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

    await client.call("UserService", "getUser", [1]);
    const metrics = client.getMetrics();
    metrics["UserService.getUser"]!.totalCalls = 999;
    expect(client.getMetrics()["UserService.getUser"]?.totalCalls).toBe(1);
    // expect(metrics["UserService.getUser"]?.totalCalls).toBe(999);
    client.close();
    await server.close();
  });

  it("resets metrics", async () => {
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

    await client.call("UserService", "getUser", [1]);

    expect(client.getMetrics()["UserService.getUser"]?.totalCalls).toBe(1);

    client.resetMetrics();

    expect(client.getMetrics()).toEqual({});

    client.close();
    await server.close();
  });

  it("limit discovery failover attempts by retryMaxAttempts", async () => {
    const server = new RpcServer();
    server.registerService("UserService", {
      async getUser(id: number) {
        return { id, name: "Alice" };
      },
    });
    await server.listen({ host: "127.0.0.1", port: 0 });
    const badPort1 = await getClosedPort();
    const badPort2 = await getClosedPort();
    const client = new RpcClient({
      mode: "discovery",
      registry: new StaticRegistry({
        UserService: [
          { host: "127.0.0.1", port: badPort1 },
          { host: "127.0.0.1", port: badPort2 },
          { host: "127.0.0.1", port: getServerPort(server) },
        ],
      }),
      loadBalancer: new RoundRobinLoadBalancer(),
      timeoutMs: 100,
      reconnect: false,
      retryMaxAttempts: 2,
    });
    await expect(
      client.call("UserService", "getUser", [1]),
    ).rejects.toMatchObject({
      code: "ECONNREFUSED",
    });
    client.close();
    await server.close();
  });

  it("tries all discovered endpoints by default", async () => {
    const server = new RpcServer();

    server.registerService("UserService", {
      async getUser(id: number) {
        return { id, name: "Alice" };
      },
    });

    await server.listen({ host: "127.0.0.1", port: 0 });

    const badPort1 = await getClosedPort();
    const badPort2 = await getClosedPort();

    const client = new RpcClient({
      mode: "discovery",
      registry: new StaticRegistry({
        UserService: [
          { host: "127.0.0.1", port: badPort1 },
          { host: "127.0.0.1", port: badPort2 },
          { host: "127.0.0.1", port: getServerPort(server) },
        ],
      }),
      loadBalancer: new RoundRobinLoadBalancer(),
      timeoutMs: 100,
      reconnect: false,
    });

    const result = await client.call("UserService", "getUser", [1]);

    expect(result).toEqual({ id: 1, name: "Alice" });

    client.close();
    await server.close();
  });

  it("passes configured retryMaxAttempts to retry context", async () => {
    const badPort = await getClosedPort();
    const retryContexts: unknown[] = [];
    const client = new RpcClient({
      mode: "discovery",
      registry: new StaticRegistry({
        UserService: [{ host: "127.0.0.1", port: badPort }],
      }),
      loadBalancer: new RoundRobinLoadBalancer(),
      timeoutMs: 100,
      reconnect: false,
      retryMaxAttempts: 1,
      retryPolicy: {
        shouldRetry(_error, context) {
          retryContexts.push(context);
          return true;
        },
      },
    });
    await expect(
      client.call("UserService", "getUser", [1]),
    ).rejects.toMatchObject({
      code: "ECONNREFUSED",
    });
    expect(retryContexts).toEqual([
      {
        serviceName: "UserService",
        method: "getUser",
        attempt: 1,
        maxAttempts: 1,
        endpoint: {
          host: "127.0.0.1",
          port: badPort,
        },
        errorCode: "ECONNREFUSED",
      },
    ]);
    client.close();
  });

  it("waits with exponential backoff before retrying discovery failover", async () => {
    const server = new RpcServer();
    server.registerService("UserService", {
      async getUser(id: number) {
        return { id, name: "Alice" };
      },
    });
    await server.listen({ host: "127.0.0.1", port: 0 });
    const badPort1 = await getClosedPort();
    const badPort2 = await getClosedPort();

    const client = new RpcClient({
      mode: "discovery",
      registry: new StaticRegistry({
        UserService: [
          { host: "127.0.0.1", port: badPort1 },
          { host: "127.0.0.1", port: badPort2 },
          { host: "127.0.0.1", port: getServerPort(server) },
        ],
      }),
      loadBalancer: new RoundRobinLoadBalancer(),
      timeoutMs: 100,
      reconnect: false,
      retryInitialBackoffMs: 20,
      retryMaxBackoffMs: 40,
    });

    const startedAt = Date.now();
    const result = await client.call("UserService", "getUser", [1]);
    const durationMs = Date.now() - startedAt;
    expect(result).toEqual({ id: 1, name: "Alice" });
    expect(durationMs).toBeGreaterThanOrEqual(55);
    client.close();
    await server.close();
  });

  it("uses method retry rule maxAttempts before global retryMaxAttempts", async () => {
    const server = new RpcServer();

    server.registerService("UserService", {
      async getUser(id: number) {
        return { id, name: "Alice" };
      },
    });

    await server.listen({ host: "127.0.0.1", port: 0 });

    const badPort1 = await getClosedPort();
    const badPort2 = await getClosedPort();

    const client = new RpcClient({
      mode: "discovery",
      registry: new StaticRegistry({
        UserService: [
          { host: "127.0.0.1", port: badPort1 },
          { host: "127.0.0.1", port: badPort2 },
          { host: "127.0.0.1", port: getServerPort(server) },
        ],
      }),
      loadBalancer: new RoundRobinLoadBalancer(),
      timeoutMs: 100,
      reconnect: false,
      retryMaxAttempts: 3,
      retryRules: {
        "UserService.getUser": {
          maxAttempts: 2,
        },
      },
    });

    await expect(
      client.call("UserService", "getUser", [1]),
    ).rejects.toMatchObject({
      code: "ECONNREFUSED",
    });

    client.close();
    await server.close();
  });

  it("uses global retryMaxAttempts when method retry rule is absent", async () => {
    const server = new RpcServer();

    server.registerService("UserService", {
      async getUser(id: number) {
        return { id, name: "Alice" };
      },
    });

    await server.listen({ host: "127.0.0.1", port: 0 });

    const badPort1 = await getClosedPort();
    const badPort2 = await getClosedPort();

    const client = new RpcClient({
      mode: "discovery",
      registry: new StaticRegistry({
        UserService: [
          { host: "127.0.0.1", port: badPort1 },
          { host: "127.0.0.1", port: badPort2 },
          { host: "127.0.0.1", port: getServerPort(server) },
        ],
      }),
      loadBalancer: new RoundRobinLoadBalancer(),
      timeoutMs: 100,
      reconnect: false,
      retryMaxAttempts: 3,
      retryRules: {
        "OrderService.createOrder": {
          maxAttempts: 1,
        },
      },
    });

    const result = await client.call("UserService", "getUser", [1]);

    expect(result).toEqual({ id: 1, name: "Alice" });

    client.close();
    await server.close();
  });

  it("uses method retry rule backoff before global retry backoff", async () => {
    const server = new RpcServer();

    server.registerService("UserService", {
      async getUser(id: number) {
        return { id, name: "Alice" };
      },
    });

    await server.listen({ host: "127.0.0.1", port: 0 });

    const badPort1 = await getClosedPort();
    const badPort2 = await getClosedPort();

    const client = new RpcClient({
      mode: "discovery",
      registry: new StaticRegistry({
        UserService: [
          { host: "127.0.0.1", port: badPort1 },
          { host: "127.0.0.1", port: badPort2 },
          { host: "127.0.0.1", port: getServerPort(server) },
        ],
      }),
      loadBalancer: new RoundRobinLoadBalancer(),
      timeoutMs: 100,
      reconnect: false,
      retryInitialBackoffMs: 1,
      retryMaxBackoffMs: 1,
      retryRules: {
        "UserService.getUser": {
          initialBackoffMs: 20,
          maxBackoffMs: 40,
        },
      },
    });

    const startedAt = Date.now();

    const result = await client.call("UserService", "getUser", [1]);

    const durationMs = Date.now() - startedAt;

    expect(result).toEqual({ id: 1, name: "Alice" });
    expect(durationMs).toBeGreaterThanOrEqual(55);

    client.close();
    await server.close();
  });

  it("open circuit breaker after failures", async () => {
    const server = new RpcServer();
    server.registerService("UserService", {
      async fail() {
        throw new Error("boom");
      },
    });

    await server.listen({ host: "127.0.0.1", port: 0 });

    const client = new RpcClient({
      mode: "direct",
      host: "127.0.0.1",
      port: getServerPort(server),
      timeoutMs: 1000,
      circuitBreakerOptions: {
        failureThreshold: 1,
        resetTimeoutMs: 1000,
      },
    });

    await expect(client.call("UserService", "fail", [])).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
    });

    client.close();
    await server.close();
  });

  it("does not send rpc request when circuit is open", async () => {
    const server = new RpcServer();
    let callCount = 0;
    server.registerService("UserService", {
      async fail() {
        callCount += 1;
        throw new Error("boom");
      },
    });
    await server.listen({ host: "127.0.0.1", port: 0 });
    const client = new RpcClient({
      mode: "direct",
      host: "127.0.0.1",
      port: getServerPort(server),
      timeoutMs: 1000,
      circuitBreakerOptions: {
        failureThreshold: 1,
        resetTimeoutMs: 1000,
      },
    });
    await expect(client.call("UserService", "fail", [])).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
    });
    expect(callCount).toBe(1);

    client.close();
    await server.close();
  });

  it("recovers after circuit breaker half-open probe succeeds", async () => {
    const server = new RpcServer();
    let shouldFail = true;
    let callCount = 0;

    server.registerService("UserService", {
      async unstableMethod() {
        callCount += 1;

        if (shouldFail) {
          throw new Error("simulated server failure");
        }

        return "ok";
      },
    });

    await server.listen({ host: "127.0.0.1", port: 0 });

    const client = new RpcClient({
      mode: "direct",
      host: "127.0.0.1",
      port: getServerPort(server),
      timeoutMs: 1000,
      circuitBreakerOptions: {
        failureThreshold: 1,
        resetTimeoutMs: 10,
      },
    });

    // First call reaches the server and fails.
    await expect(
      client.call("UserService", "unstableMethod", []),
    ).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
    });

    expect(callCount).toBe(1);

    // Circuit is open now, so this request should be rejected locally.
    await expect(
      client.call("UserService", "unstableMethod", []),
    ).rejects.toMatchObject({
      code: "CIRCUIT_BREAKER_OPEN",
    });

    expect(callCount).toBe(1);

    shouldFail = false;
    await new Promise((resolve) => setTimeout(resolve, 15));

    // Half-open probe succeeds and closes the circuit.
    await expect(
      client.call("UserService", "unstableMethod", []),
    ).resolves.toBe("ok");

    expect(callCount).toBe(2);

    // Circuit is closed again, so normal calls continue.
    await expect(
      client.call("UserService", "unstableMethod", []),
    ).resolves.toBe("ok");

    expect(callCount).toBe(3);

    client.close();
    await server.close();
  });

  it("allows rpc calls while rate limiter has tokens", async () => {
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
      rateLimiterOptions: {
        capacity: 1,
        refillTokens: 1,
        refillIntervalMs: 1000,
      },
    });
    const result = await client.call("UserService", "getUser", [1]);
    expect(result).toEqual({ id: 1, name: "Alice" });
    client.close();
    await server.close();
  });

  it("rejects locally when rate limit is exceeded", async () => {
    const server = new RpcServer();
    let callCount = 0;

    server.registerService("UserService", {
      async getUser(id: number) {
        callCount += 1;
        return { id, name: "Alice" };
      },
    });

    await server.listen({ host: "127.0.0.1", port: 0 });

    const client = new RpcClient({
      mode: "direct",
      host: "127.0.0.1",
      port: getServerPort(server),
      timeoutMs: 1000,
      rateLimiterOptions: {
        capacity: 1,
        refillTokens: 1,
        refillIntervalMs: 1000,
      },
    });

    const result = await client.call("UserService", "getUser", [1]);

    expect(result).toEqual({ id: 1, name: "Alice" });

    await expect(
      client.call("UserService", "getUser", [2]),
    ).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });

    expect(callCount).toBe(1);

    client.close();
    await server.close();
  });

  it("allows calls again after rate limiter refills tokens", async () => {
    const server = new RpcServer();
    let callCount = 0;

    server.registerService("UserService", {
      async getUser(id: number) {
        callCount += 1;
        return { id, name: `User-${id}` };
      },
    });

    await server.listen({ host: "127.0.0.1", port: 0 });

    const client = new RpcClient({
      mode: "direct",
      host: "127.0.0.1",
      port: getServerPort(server),
      timeoutMs: 1000,
      rateLimiterOptions: {
        capacity: 1,
        refillTokens: 1,
        refillIntervalMs: 10,
      },
    });

    await expect(client.call("UserService", "getUser", [1])).resolves.toEqual({
      id: 1,
      name: "User-1",
    });

    await expect(
      client.call("UserService", "getUser", [2]),
    ).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });

    await new Promise((resolve) => setTimeout(resolve, 15));

    await expect(client.call("UserService", "getUser", [3])).resolves.toEqual({
      id: 3,
      name: "User-3",
    });

    expect(callCount).toBe(2);

    client.close();
    await server.close();
  });

  it("logs client successful rpc call", async () => {
    const server = new RpcServer();
    server.registerService("UserService", {
      async getUser(id: number) {
        return { id, name: "Alice" };
      },
    });

    await server.listen({ host: "127.0.0.1", port: 0 });
    const logger = createTestLogger();
    const client = new RpcClient({
      mode: "direct",
      host: "127.0.0.1",
      port: getServerPort(server),
      timeoutMs: 1000,
      logger,
    });

    const result = await client.call("UserService", "getUser", [1], {
      metadata: {
        traceId: "trace-client-success",
      },
    });

    expect(result).toEqual({ id: 1, name: "Alice" });
    expect(logger.infos).toHaveLength(1);
    expect(logger.infos[0]).toMatchObject({
      message: "rpc client call succeeded",
      fields: {
        service: "UserService",
        method: "getUser",
        traceId: "trace-client-success",
      },
    });
    expect(logger.infos[0]?.fields?.requestId).toEqual(expect.any(String));
    expect(logger.infos[0]?.fields?.durationMs).toEqual(expect.any(Number));
    client.close();
    await server.close();
  });

  it("logs client failed rpc call", async () => {
    const server = new RpcServer();

    server.registerService("UserService", {
      async getUser(id: number) {
        return { id, name: "Alice" };
      },
    });

    await server.listen({ host: "127.0.0.1", port: 0 });

    const logger = createTestLogger();

    const client = new RpcClient({
      mode: "direct",
      host: "127.0.0.1",
      port: getServerPort(server),
      timeoutMs: 1000,
      logger,
    });

    await expect(
      client.call("UserService", "missingMethod", [], {
        metadata: {
          traceId: "trace-client-failed",
        },
      }),
    ).rejects.toMatchObject({
      code: "METHOD_NOT_FOUND",
    });

    expect(logger.errors).toHaveLength(1);
    expect(logger.errors[0]).toMatchObject({
      message: "rpc client call failed",
      fields: {
        service: "UserService",
        method: "missingMethod",
        traceId: "trace-client-failed",
        errorCode: "METHOD_NOT_FOUND",
      },
    });
    expect(logger.errors[0]?.fields?.requestId).toEqual(expect.any(String));
    expect(logger.errors[0]?.fields?.durationMs).toEqual(expect.any(Number));

    client.close();
    await server.close();
  });

  it("logs warning when client call is rate limited", async () => {
    const logger = createTestLogger();

    const client = new RpcClient({
      mode: "direct",
      host: "127.0.0.1",
      port: 4000,
      timeoutMs: 1000,
      rateLimiterOptions: {
        capacity: 1,
        refillTokens: 1,
        refillIntervalMs: 1000,
      },
      logger,
    });

    await expect(
      client.call("UserService", "getUser", [1], {
        metadata: {
          traceId: "trace-rate-limited",
        },
      }),
    ).rejects.toMatchObject({
      code: "ECONNREFUSED",
    });

    await expect(
      client.call("UserService", "getUser", [1], {
        metadata: {
          traceId: "trace-rate-limited",
        },
      }),
    ).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });

    expect(logger.warns).toHaveLength(1);
    expect(logger.warns[0]).toMatchObject({
      message: "rpc client call rate limited",
      fields: {
        service: "UserService",
        method: "getUser",
        traceId: "trace-rate-limited",
        requestId: expect.any(String),
      },
    });

    client.close();
  });
  it("logs warning when circuit breaker is open", async () => {
    const logger = createTestLogger();
    const server = new RpcServer();

    server.registerService("UserService", {
      async fail() {
        throw new Error("boom");
      },
    });

    await server.listen({ host: "127.0.0.1", port: 0 });

    const client = new RpcClient({
      mode: "direct",
      host: "127.0.0.1",
      port: getServerPort(server),
      timeoutMs: 1000,
      circuitBreakerOptions: {
        failureThreshold: 1,
        resetTimeoutMs: 1000,
      },
      logger,
    });

    await expect(
      client.call("UserService", "fail", [], {
        metadata: {
          traceId: "trace-circuit-failed",
        },
      }),
    ).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
    });

    await expect(
      client.call("UserService", "fail", [], {
        metadata: {
          traceId: "trace-circuit-open",
        },
      }),
    ).rejects.toMatchObject({
      code: "CIRCUIT_BREAKER_OPEN",
    });

    expect(logger.warns).toHaveLength(1);
    expect(logger.warns[0]).toMatchObject({
      message: "rpc client circuit breaker open",
      fields: {
        service: "UserService",
        method: "fail",
        traceId: "trace-circuit-open",
        requestId: expect.any(String),
      },
    });

    client.close();
    await server.close();
  });

  it("logs warning when discovery call retries failed endpoint", async () => {
    const logger = createTestLogger();
    const server = new RpcServer();

    server.registerService("UserService", {
      async getUser(id: number) {
        return { id, name: "Alice" };
      },
    });

    await server.listen({ host: "127.0.0.1", port: 0 });

    const client = new RpcClient({
      mode: "discovery",
      registry: new StaticRegistry({
        UserService: [
          { host: "127.0.0.1", port: 65500 },
          { host: "127.0.0.1", port: getServerPort(server) },
        ],
      }),
      loadBalancer: new RoundRobinLoadBalancer(),
      timeoutMs: 1000,
      retryMaxAttempts: 2,
      logger,
    });

    await expect(
      client.call("UserService", "getUser", [1], {
        metadata: {
          traceId: "trace-retry",
        },
      }),
    ).resolves.toEqual({ id: 1, name: "Alice" });

    expect(logger.warns).toHaveLength(1);
    expect(logger.warns[0]).toMatchObject({
      message: "rpc client retry attempt failed",
      fields: {
        service: "UserService",
        method: "getUser",
        traceId: "trace-retry",
        requestId: expect.any(String),
        attempt: 1,
        maxAttempts: 2,
        endpoint: {
          host: "127.0.0.1",
          port: 65500,
        },
        errorCode: "ECONNREFUSED",
        backoffMs: expect.any(Number),
      },
    });

    expect(logger.infos).toHaveLength(1);
    expect(logger.infos[0]).toMatchObject({
      message: "rpc client call succeeded",
      fields: {
        service: "UserService",
        method: "getUser",
        traceId: "trace-retry",
      },
    });

    client.close();
    await server.close();
  });

  it("calls remote service with protobuf serializer", async () => {
    const server = new RpcServer();
    server.registerService("UserService", {
      async getUser(id: number) {
        return { id, name: "Alice" };
      },
    });
    
    await server.listen({
      host: "127.0.0.1",
      port: 0,
      serializer: new ProtobufSerializer(),
    });

    const client = new RpcClient({
      mode: "direct",
      host: "127.0.0.1",
      port: getServerPort(server),
      timeoutMs: 1000,
      serializer: new ProtobufSerializer(),
    });

    await expect(client.call("UserService", "getUser", [1])).resolves.toEqual({
      id: 1,
      name: "Alice",
    });

    client.close();
    await server.close();
  });

  it("calls remote service with gzip compression", async () => {
    const compression = {
      compressor: new GzipCompressor(),
      thresholdBytes: 1,
    };
    const server = new RpcServer();
    const content = "x".repeat(4096);

    server.registerService("FileService", {
      async download() {
        return { content };
      },
    });

    await server.listen({
      host: "127.0.0.1",
      port: 0,
      compression,
    });

    const client = new RpcClient({
      mode: "direct",
      host: "127.0.0.1",
      port: getServerPort(server),
      timeoutMs: 1000,
      compression,
    });

    await expect(client.call("FileService", "download", [])).resolves.toEqual({
      content,
    });

    client.close();
    await server.close();
  });
  
  it("calls discovered remote service with protobuf serializer", async () => {
    const server = new RpcServer();

    server.registerService("UserService", {
      async getUser(id: number) {
        return { id, name: "Alice" };
      },
    });

    await server.listen({
      host: "127.0.0.1",
      port: 0,
      serializer: new ProtobufSerializer(),
    });
    
    const client = new RpcClient({
      mode: "discovery",
      registry: new StaticRegistry({
        UserService: [
          {
            host: "127.0.0.1",
            port: getServerPort(server),
          },
        ],
      }),
      loadBalancer: new RoundRobinLoadBalancer(),
      timeoutMs: 1000,
      serializer: new ProtobufSerializer(),
    });
    await expect(client.call("UserService", "getUser", [1])).resolves.toEqual({
      id: 1,
      name: "Alice",
    });
    client.close();
    await server.close();
  });
  
});
