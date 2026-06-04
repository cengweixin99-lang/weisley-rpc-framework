import { randomUUID } from "node:crypto";
import { RpcCodec, type RpcRequest } from "@weisley-rpc/protocol";
import type { ConnectionState, RpcClientOptions } from "../types.js";
import { createProxy, type RpcProxy } from "./proxy.js";
import { RpcConnection } from "./connection.js";

export class RpcClient {
  private readonly codec = new RpcCodec();
  private readonly connection: RpcConnection;

  constructor(options: RpcClientOptions) {
    this.connection = new RpcConnection({
      host: options.host,
      port: options.port,
      timeoutMs: options.timeoutMs ?? 5000,
      heartbeatIntervalMs: options.heartbeatIntervalMs,
      heartbeatTimeoutMs: options.heartbeatTimeoutMs,
      reconnect: options.reconnect,
      reconnectInitialDelayMs: options.reconnectInitialDelayMs,
      reconnectMaxDelayMs: options.reconnectMaxDelayMs
    });
  }

  async connect(): Promise<void> {
    await this.connection.connect();
  }

  getConnectionState(): ConnectionState {
    return this.connection.getState();
  }

  async call(
    service: string,
    method: string,
    params: unknown[] = [],
  ): Promise<unknown> {
    // : Build RpcRequest, encode it, and send it through RpcConnection.
    const request: RpcRequest = {
      type: "request",
      id: randomUUID(),
      service,
      method,
      params,
    };
    return this.connection.send(request.id, this.codec.encode(request));
  }

  createProxy<
    TService extends Record<string, (...args: never[]) => Promise<unknown>>,
  >(serviceName: string): RpcProxy<TService> {
    return createProxy<TService>(this, serviceName);
  }

  close(): void {
    this.connection.close();
  }
}
