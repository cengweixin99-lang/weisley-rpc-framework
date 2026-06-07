import { Socket, createConnection } from "node:net";
import { RpcCodec, type RpcResponse } from "@weisley-rpc/protocol";
import { RpcError, RpcTimeoutError } from "../errors.js";
import type { PendingRequest } from "./pending-request.js";
import { randomUUID } from "node:crypto";
import type { ConnectionState } from "../types.js";

type RpcConnectionOptions = {
  host: string;
  port: number;
  timeoutMs: number;
  heartbeatIntervalMs?: number | undefined;
  heartbeatTimeoutMs?: number | undefined;
  reconnect?: boolean | undefined;
  reconnectInitialDelayMs?: number | undefined;
  reconnectMaxDelayMs?: number | undefined;
};

export class RpcConnection {
  private connectionPromise: Promise<void> | null = null;
  private readonly codec = new RpcCodec();
  private readonly pending = new Map<string, PendingRequest>();
  private socket: Socket | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private lastPongAt = 0;
  private state: ConnectionState = "idle";
  private manuallyClosed = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  constructor(private readonly options: RpcConnectionOptions) {}


  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return;
    }
    if (this.options.reconnect === false) {
      return;
    }
    const initialDelay = this.options.reconnectInitialDelayMs ?? 100;
    const maxDelay = this.options.reconnectMaxDelayMs ?? 2000;
    const delay = Math.min(
      initialDelay * 2 ** this.reconnectAttempts,
      maxDelay,
    );
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      if (this.manuallyClosed) {
        return;
      }
      try {
        await this.connect();
        this.reconnectAttempts = 0;
      } catch {
        this.state = "reconnecting";
        this.scheduleReconnect();
      }
    }, delay);
  }

  private handleUnexpectedDisconnect(error: Error) {
    this.stopHeartbeat();
    this.rejectAll(error);
    if (this.manuallyClosed) {
      return;
    }
    this.state = "reconnecting";
    this.scheduleReconnect();
  }

  getState(): ConnectionState {
    return this.state;
  }

  async connect(): Promise<void> {
    if (this.state === "connected" && this.socket && !this.socket.destroyed) {
      return;
    }

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = this.doConnect();

    try {
      await this.connectionPromise;
    } finally {
      this.connectionPromise = null;
    }
    
  }

  send(id: string, payload: Buffer): Promise<unknown> {
    if (!this.socket || this.socket.destroyed) {
      return Promise.reject(new RpcError("Connection is not open", "CONNECTION_NOT_OPEN"));
    }
    if (this.state !== "connected") {
      return Promise.reject(new RpcError("Connection is not connected", "CONNECTION_NOT_CONNECTED"));
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
    this.manuallyClosed = true;
    this.state = "closed";

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopHeartbeat();
    this.rejectAll(new RpcError("Connection closed", "CONNECTION_CLOSED"))
    this.socket?.end();
  }

  private async doConnect(): Promise<void> {
    this.manuallyClosed = false;
    this.state = "connecting";
    this.socket = createConnection({ host: this.options.host, port: this.options.port, timeout: this.options.timeoutMs});
    this.socket.on("data", (chunk) => this.handleData(chunk));
    this.socket.on("close", () => {
      this.handleUnexpectedDisconnect(
        new RpcError("Connection closed", "CONNECTION_CLOSED"),
      )
    });
    this.socket.on("error", (error) => {
      this.handleUnexpectedDisconnect(error);
    });

    await new Promise<void>((resolve, reject) => {
      this.socket?.once("connect", resolve);
      this.socket?.once("error", reject);
    });
    this.state = "connected";
    this.reconnectAttempts = 0;
    this.startHeartbeat();
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
        this.handleUnexpectedDisconnect(error);
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
