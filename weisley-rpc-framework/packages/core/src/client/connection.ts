import { Socket, createConnection } from "node:net";
import { RpcCodec, type RpcResponse } from "@weisley-rpc/protocol";
import { RpcError, RpcTimeoutError } from "../errors.js";
import type { PendingRequest } from "./pending-request.js";
import { randomUUID } from "node:crypto";
type RpcConnectionOptions = {
  host: string;
  port: number;
  timeoutMs: number;
  heartbeatIntervalMs?: number | undefined;
  heartbeatTimeoutMs?: number | undefined;
};

export class RpcConnection {
  private readonly codec = new RpcCodec();
  private readonly pending = new Map<string, PendingRequest>();
  private socket: Socket | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private lastPongAt = 0;

  constructor(private readonly options: RpcConnectionOptions) {}

  async connect(): Promise<void> {
    if (this.socket && !this.socket.destroyed) {
      return;
    }

    this.socket = createConnection({ host: this.options.host, port: this.options.port, timeout: this.options.timeoutMs});
    this.socket.on("data", (chunk) => this.handleData(chunk));
    this.socket.on("close", () => {
      this.stopHeartbeat();
      this.rejectAll(new RpcError("Connection closed", "CONNECTION_CLOSED"))
    });
    this.socket.on("error", (error) => {
      this.stopHeartbeat();
      this.rejectAll(error)
    });

    await new Promise<void>((resolve, reject) => {
      this.socket?.once("connect", resolve);
      this.socket?.once("error", reject);
    });
    this.startHeartbeat();
  }

  send(id: string, payload: Buffer): Promise<unknown> {
    if (!this.socket || this.socket.destroyed) {
      return Promise.reject(new RpcError("Connection is not open", "CONNECTION_NOT_OPEN"));
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new RpcTimeoutError(this.options.timeoutMs));
      }, this.options.timeoutMs);

      this.pending.set(id, { resolve, reject, timer });
      this.socket?.write(payload);
    });
  }

  close(): void {
    this.stopHeartbeat();
    this.socket?.end();
  }

  private startHeartbeat(): void {
    const intervalMs = this.options.heartbeatIntervalMs;
    if (!intervalMs) {
      return;
    }
    this.lastPongAt = Date.now();
    this.heartbeatTimer = setInterval(() => {
      if (!this.socket || this.socket.destroyed) {
        this.stopHeartbeat();
        return;
      }
      const timeoutMs = this.options.heartbeatTimeoutMs ?? intervalMs * 2;
      if (Date.now() - this.lastPongAt > timeoutMs) {
        const error = new RpcError("Heartbeat timeout","HEARTBEAT_TIMEOUT");
        this.stopHeartbeat();
        this.rejectAll(error);
        this.socket.destroy(error);
        return;
      } 
      this.socket.write(
        this.codec.encode({
          type: "ping",
          id: randomUUID(),
          timestamp: Date.now(),
        }),
      );
    }, intervalMs);
  }

  private stopHeartbeat(): void {
      if (!this.heartbeatTimer) {
        return;
      }
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
  }

  private handleData(chunk: Buffer): void {
    const messages = this.codec.push(chunk);

    for (const message of messages) {
      if (message.type === "response"){
        const pending = this.pending.get(message.id);
        if (!pending) {
          continue;
        }

        clearTimeout(pending.timer);
        this.pending.delete(message.id);

        if (message.ok) {
          pending.resolve(message.result);
        } else {
          pending.reject(new RpcError(message.error?.message ?? "RPC call failed", message.error?.code));
        }
      }
      if (message.type === "pong") {
        // 心跳处理逻辑
        this.lastPongAt = Date.now();
      }
    }
  }

  private rejectAll(error: Error): void {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(error);
      this.pending.delete(id);
    }
  }
}
