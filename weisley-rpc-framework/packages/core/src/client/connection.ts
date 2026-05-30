import { Socket, createConnection } from "node:net";
import { RpcCodec, type RpcResponse } from "@weisley-rpc/protocol";
import { RpcError, RpcTimeoutError } from "../errors.js";
import type { PendingRequest } from "./pending-request.js";

export class RpcConnection {
  private readonly codec = new RpcCodec();
  private readonly pending = new Map<string, PendingRequest>();
  private socket: Socket | null = null;

  constructor(
    private readonly host: string,
    private readonly port: number,
    private readonly timeoutMs: number,
  ) {}

  async connect(): Promise<void> {
    if (this.socket && !this.socket.destroyed) {
      return;
    }

    this.socket = createConnection({ host: this.host, port: this.port });
    this.socket.on("data", (chunk) => this.handleData(chunk));
    this.socket.on("close", () => this.rejectAll(new RpcError("Connection closed", "CONNECTION_CLOSED")));
    this.socket.on("error", (error) => this.rejectAll(error));

    await new Promise<void>((resolve, reject) => {
      this.socket?.once("connect", resolve);
      this.socket?.once("error", reject);
    });
  }

  send(id: string, payload: Buffer): Promise<unknown> {
    if (!this.socket || this.socket.destroyed) {
      return Promise.reject(new RpcError("Connection is not open", "CONNECTION_NOT_OPEN"));
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new RpcTimeoutError(this.timeoutMs));
      }, this.timeoutMs);

      this.pending.set(id, { resolve, reject, timer });
      this.socket?.write(payload);
    });
  }

  close(): void {
    this.socket?.end();
  }

  private handleData(chunk: Buffer): void {
    const messages = this.codec.push(chunk) as RpcResponse[];

    for (const message of messages) {
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
  }

  private rejectAll(error: Error): void {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(error);
      this.pending.delete(id);
    }
  }
}
