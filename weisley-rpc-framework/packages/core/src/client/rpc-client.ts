import { randomUUID } from "node:crypto";
import { RpcCodec, type RpcRequest } from "@weisley-rpc/protocol";
import type { ConnectionState, RpcClientOptions } from "../types.js";
import { createProxy, type RpcProxy } from "./proxy.js";
import { RpcConnection } from "./connection.js";
import { DefaultRetryPolicy, type RetryPolicy } from "./retry-policy.js";
export class RpcClient {
  private readonly codec = new RpcCodec();
  private readonly connections = new Map<string, RpcConnection>();
  private readonly retryPolicy: RetryPolicy;

  constructor(private readonly options: RpcClientOptions) {
    this.retryPolicy = options.retryPolicy ?? new DefaultRetryPolicy();
  }

  async connect(): Promise<void> {
    if (this.options.mode === "discovery") {
      return;
    }

    const connection = this.getOrCreateConnection(this.options.host, this.options.port);
    await connection.connect();
  }

  getConnectionState(): ConnectionState {
    if (this.options.mode === "discovery") {
      return "idle";
    }

    const connection = this.connections.get(this.getEndpointKey(this.options.host, this.options.port));
    return connection?.getState() ?? "idle";
  }

  async call(
    service: string,
    method: string,
    params: unknown[] = [],
  ): Promise<unknown> {
    const request: RpcRequest = {
      type: "request",
      id: randomUUID(),
      service,
      method,
      params,
    };

    if (this.options.mode === "direct") {
      return this.callDirect(request);
    }
    return this.callWithDiscoveryFailover(service, request);
  }

  private async callDirect(request: RpcRequest): Promise<unknown> {
    if (this.options.mode !== "direct") {
      throw new Error("RpcClient is not in direct mode");
    }
    const connection = this.getOrCreateConnection(this.options.host, this.options.port);
    if (connection.getState() !== "connected") {
      await connection.connect();
    }
    return connection.send(request.id, this.codec.encode(request));
  }
  
  private async callWithDiscoveryFailover(serviceName: string, request: RpcRequest): Promise<unknown> {
    if (this.options.mode !== "discovery") {
      throw new Error("RpcClient is not in discovery mode");
    }
    const endpoints = this.options.registry.lookup(serviceName);
    let lastError: unknown;
    for (let attempt = 0; attempt < endpoints.length; attempt += 1) {
      const endpoint = this.options.loadBalancer.select(serviceName, endpoints);
      const connection = this.getOrCreateConnection(endpoint.host, endpoint.port);
      try {
        if (connection.getState() !== "connected") {
          await connection.connect();
        }
        return await connection.send(request.id, this.codec.encode(request));
      } catch (error) {
        lastError = error;
        if (!this.retryPolicy.shouldRetry(error)) {
          throw error;
        }
      }
    }

    if (lastError instanceof Error) {
      throw lastError;
    }
    throw new Error(`No available endpoint for service: ${serviceName}`);
  }
  
  createProxy<
    TService extends Record<string, (...args: never[]) => Promise<unknown>>,
  >(serviceName: string): RpcProxy<TService> {
    return createProxy<TService>(this, serviceName);
  }

  close(): void {
    for (const connection of this.connections.values()) {
      connection.close();
    }
  }

  /* private resolveConnection(serviceName: string): RpcConnection {
    if (this.options.mode === "direct") {
      return this.getOrCreateConnection(this.options.host, this.options.port);
    }

    const endpoints = this.options.registry.lookup(serviceName);
    const endpoint = this.options.loadBalancer.select(serviceName, endpoints);
    return this.getOrCreateConnection(endpoint.host, endpoint.port);
  } */

  // private isRetryableError(error: unknown): boolean {
  //   if (error instanceof RpcError) {
  //     return [
  //       "CONNECTION_CLOSED",
  //       "CONNECTION_NOT_OPEN",
  //       "CONNECTION_NOT_CONNECTIED",
  //       "RPC_TIMEOUT",
  //       "HEARTBEAT_TIMEOUT",
  //     ].includes(error.code);
  //   }
  //   if (error && typeof error === "object" && "code" in error) {
  //     const code = String(error.code);
  //     return [
  //       "ECONNREFUSED",
  //       "ECONNRESET",
  //       "ETIMEOUT",
  //       "EPIPE",
  //     ].includes(code);
  //   }
  //   return false;
  // }
  
  private getOrCreateConnection(host: string, port: number): RpcConnection {
    const key = this.getEndpointKey(host, port);
    const existing = this.connections.get(key);

    if (existing) {
      return existing;
    }

    const connection = new RpcConnection({
      host,
      port,
      timeoutMs: this.options.timeoutMs ?? 5000,
      heartbeatIntervalMs: this.options.heartbeatIntervalMs,
      heartbeatTimeoutMs: this.options.heartbeatTimeoutMs,
      reconnect: this.options.reconnect,
      reconnectInitialDelayMs: this.options.reconnectInitialDelayMs,
      reconnectMaxDelayMs: this.options.reconnectMaxDelayMs,
    });

    this.connections.set(key, connection);

    return connection;
  }

  private getEndpointKey(host: string, port: number): string {
    return `${host}:${port}`;
  }
}
