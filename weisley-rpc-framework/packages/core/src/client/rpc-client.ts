import { randomUUID } from "node:crypto";
import { RpcCodec, type RpcRequest } from "@weisley-rpc/protocol";
import type {
  ConnectionState,
  RpcClientConnectionStats,
  RpcClientMetrics,
  RpcClientOptions,
  RpcMethodMetrics,
} from "../types.js";
import { createProxy, type RpcProxy } from "./proxy.js";
import { RpcConnection } from "./connection.js";
import { DefaultRetryPolicy, type RetryPolicy } from "./retry-policy.js";
import { RpcConnectionPool } from "./connection-pool.js";

export class RpcClient {
  private readonly metrics = new Map<string, RpcMethodMetrics>();
  private readonly codec = new RpcCodec();
  private readonly pools = new Map<string, RpcConnectionPool>();
  private readonly retryPolicy: RetryPolicy;

  constructor(private readonly options: RpcClientOptions) {
    this.retryPolicy = options.retryPolicy ?? new DefaultRetryPolicy();
  }

  getConnectionStats(): RpcClientConnectionStats {
    const stats: RpcClientConnectionStats = {};
    for (const [endpoint, pool] of this.pools) {
      stats[endpoint] = pool.getStats();
    }
    return stats;
  }

  async connect(): Promise<void> {
    if (this.options.mode === "discovery") {
      return;
    }

    const connection = this.getConnection(this.options.host, this.options.port);
    await connection.connect();
  }

  getConnectionState(): ConnectionState {
    if (this.options.mode === "discovery") {
      return "idle";
    }

    const pool = this.pools.get(this.getEndpointKey(this.options.host, this.options.port));
    return pool?.getState() ?? "idle";
  }

  async call(
    service: string,
    method: string,
    params: unknown[] = [],
  ): Promise<unknown> {
    const startedAt = Date.now();
    try {
      const request: RpcRequest = {
        type: "request",
        id: randomUUID(),
        service,
        method,
        params,
      };
      const result = this.options.mode === "direct"
        ? await this.callDirect(request)
        : await this.callWithDiscoveryFailover(service, request);

      this.recordMetrics(service, method, Date.now() - startedAt, true);

      return result;
    } catch (error) {
      this.recordMetrics(
        service,
        method,
        Date.now() - startedAt,
        false,
        this.getErrorCode(error),
      );
      throw error;
    }
  }

  createProxy<
    TService extends Record<string, (...args: never[]) => Promise<unknown>>,
  >(serviceName: string): RpcProxy<TService> {
    return createProxy<TService>(this, serviceName);
  }

  close(): void {
    for (const pool of this.pools.values()) {
      pool.close();
    }
  }

  getMetrics(): RpcClientMetrics {
    const snapshot: RpcClientMetrics = {};
    for (const [key, value] of this.metrics) {
      snapshot[key] = { ...value };
    }
    return snapshot;
  }

  resetMetrics(): void {
    this.metrics.clear();
  }

  private recordMetrics(
    service: string,
    method: string,
    durationMs: number,
    success: boolean,
    errorCode?: string,
  ): void {
    const key = this.getMethodKey(service, method);
    const current = this.metrics.get(key) ?? {
      totalCalls: 0,
      successCalls: 0,
      failedCalls: 0,
      totalDurationMs: 0,
      averageDurationMs: 0,
    };

    current.totalCalls += 1;
    current.totalDurationMs += durationMs;
    current.averageDurationMs = current.totalDurationMs / current.totalCalls;

    if (success) {
      current.successCalls += 1;
    } else {
      current.failedCalls += 1;
      current.lastErrorCode = errorCode;
    }

    this.metrics.set(key, current);
  }

  private getMethodKey(service: string, method: string): string {
    return `${service}.${method}`;
  }

  private getErrorCode(error: unknown): string | undefined {
    if (error && typeof error === "object" && "code" in error) {
      return String(error.code);
    }

    return undefined;
  }

  private async callDirect(request: RpcRequest): Promise<unknown> {
    if (this.options.mode !== "direct") {
      throw new Error("RpcClient is not in direct mode");
    }

    const connection = this.getConnection(this.options.host, this.options.port);
    if (connection.getState() !== "connected") {
      await connection.connect();
    }

    return connection.send(request.id, this.codec.encode(request));
  }

  private async callWithDiscoveryFailover(
    serviceName: string,
    request: RpcRequest,
  ): Promise<unknown> {
    if (this.options.mode !== "discovery") {
      throw new Error("RpcClient is not in discovery mode");
    }

    const endpoints = this.options.registry.lookup(serviceName);
    let lastError: unknown;

    for (let attempt = 0; attempt < endpoints.length; attempt += 1) {
      const endpoint = this.options.loadBalancer.select(serviceName, endpoints);
      const connection = this.getConnection(endpoint.host, endpoint.port);

      try {
        if (connection.getState() !== "connected") {
          await connection.connect();
        }

        return await connection.send(request.id, this.codec.encode(request));
      } catch (error) {
        lastError = error;

        if (!this.retryPolicy.shouldRetry(error, {
          serviceName,
          attempt: attempt + 1,
          maxAttempts: endpoints.length,
          endpoint,
        })) {
          throw error;
        }
      }
    }

    if (lastError instanceof Error) {
      throw lastError;
    }

    throw new Error(`No available endpoint for service: ${serviceName}`);
  }

  private getConnection(host: string, port: number): RpcConnection {
    const key = this.getEndpointKey(host, port);
    let pool = this.pools.get(key);

    if (!pool) {
      pool = new RpcConnectionPool({
        host,
        port,
        maxConnections: this.options.maxConnectionsPerEndpoint ?? 1,
        connectionOptions: {
          timeoutMs: this.options.timeoutMs ?? 5000,
          heartbeatIntervalMs: this.options.heartbeatIntervalMs,
          heartbeatTimeoutMs: this.options.heartbeatTimeoutMs,
          reconnect: this.options.reconnect,
          reconnectInitialDelayMs: this.options.reconnectInitialDelayMs,
          reconnectMaxDelayMs: this.options.reconnectMaxDelayMs,
        },
      });
      this.pools.set(key, pool);
    }

    return pool.getConnection();
  }

  private getEndpointKey(host: string, port: number): string {
    return `${host}:${port}`;
  }
}
