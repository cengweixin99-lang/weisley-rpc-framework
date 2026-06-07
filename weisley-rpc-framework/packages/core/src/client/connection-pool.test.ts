import { describe, expect, it } from "vitest";
import { RpcConnectionPool } from "./connection-pool.js";

const connectionOptions = {
  timeoutMs: 1000,
};

describe("RpcConnectionPool", () => {
  it("creates connections up to maxConnections", () => {
    const pool = new RpcConnectionPool({
      host: "127.0.0.1",
      port: 4000,
      maxConnections: 2,
      connectionOptions,
    });

    const first = pool.getConnection();
    const second = pool.getConnection();
    const third = pool.getConnection();

    expect(first).not.toBe(second);
    expect(third).toBe(first);

    pool.close();
  });

  it("rejects invalid maxConnections", () => {
    expect(() => {
      new RpcConnectionPool({
        host: "127.0.0.1",
        port: 4000,
        maxConnections: 0,
        connectionOptions,
      });
    }).toThrow("maxConnections must be greater than 0");
  });

  it("returns idle state before any connection is created", () => {
    const pool = new RpcConnectionPool({
      host: "127.0.0.1",
      port: 4000,
      maxConnections: 1,
      connectionOptions,
    });

    expect(pool.getState()).toBe("idle");

    pool.close();
  });
});