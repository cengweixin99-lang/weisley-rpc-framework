import { createServer, Socket, type AddressInfo, type Server } from "node:net";
import {
  JsonSerializer,
  RpcCodec,
  type RpcCodecCompressionOptions,
  type RpcCodecOptions,
  type Serializer,
} from "@weisley-rpc/protocol";
import type { RpcServerOptions, ServiceImplementation } from "../types.js";
import { MethodInvoker } from "./method-invoker.js";
import { ServiceRegistry } from "./service-registry.js";

export type RpcServerCloseOptions = {
  graceful?: boolean;
  timeoutMs?: number;
};

export type RpcServerState = "idle" | "listening" | "draining" | "closed";

export class RpcServer {
  private readonly registry = new ServiceRegistry();
  private readonly invoker = new MethodInvoker(this.registry);
  private server: Server | null = null;
  private readonly sockets = new Set<Socket>();
  private logger?: RpcServerOptions["logger"];
  private serializer: Serializer = new JsonSerializer();
  private compression: RpcCodecCompressionOptions | undefined;
  private maxBodyLength: number | undefined;
  private maxDecompressedBodyLength: number | undefined;
  private activeRequests = 0;
  private drainResolvers: Array<() => void> = [];
  private state: RpcServerState = "idle";

  registerService(
    serviceName: string,
    implementation: ServiceImplementation,
  ): void {
    this.registry.register(serviceName, implementation);
  }

  async listen(options: RpcServerOptions): Promise<void> {
    this.logger = options.logger;
    this.serializer = options.serializer ?? new JsonSerializer();
    this.compression = options.compression;
    this.maxBodyLength = options.maxBodyLength;
    this.maxDecompressedBodyLength = options.maxDecompressedBodyLength;

    this.server = createServer((socket) => this.handleConnection(socket));

    await new Promise<void>((resolve, reject) => {
      this.server?.once("error", reject);
      this.server?.listen(options.port, options.host ?? "127.0.0.1", resolve);
    });
    this.state = "listening";
  }

  getState(): RpcServerState {
    return this.state;
  }

  getConnectionCount(): number {
    return this.sockets.size;
  }
  address(): AddressInfo | null {
    const address = this.server?.address();
    if (!address || typeof address === "string") {
      return null;
    }

    return address;
  }

  async close(options: RpcServerCloseOptions = {}): Promise<void> {
    if (!this.server) {
      return;
    }

    const server = this.server;
    this.server = null;

    if (options.graceful) {
      this.state = "draining";
      const closePromise = this.closeServer(server);
      await this.waitForActiveRequests(options.timeoutMs ?? 3000);
      this.closeConnections();
      await closePromise;
      this.state = "closed";
      return;
    }

    this.state = "closed";
    this.closeConnections();
    await this.closeServer(server);
  }
  closeConnections(): void {
    for (const socket of this.sockets) {
      socket.destroy();
    }
    this.sockets.clear();
  }

  private handleConnection(socket: Socket): void {
    this.sockets.add(socket);
    socket.on("close", () => {
      this.sockets.delete(socket);
    });
    const codecOptions: RpcCodecOptions = {
      serializer: this.serializer,
    };

    if (this.compression) {
      codecOptions.compression = this.compression;
    }

    if (this.maxBodyLength !== undefined) {
      codecOptions.maxBodyLength = this.maxBodyLength;
    }

    if (this.maxDecompressedBodyLength !== undefined) {
      codecOptions.maxDecompressedBodyLength = this.maxDecompressedBodyLength;
    }

    const codec = new RpcCodec(codecOptions);
    socket.on("data", async (chunk) => {
      try {
        const messages = codec.push(chunk);

        for (const message of messages) {
          if (message.type === "request") {
            if (this.state === "draining") {
              const response = {
                type: "response" as const,
                id: message.id,
                ok: false,
                error: {
                  code: "SERVER_DRAINING",
                  message: "RPC server is draining",
                },
              };

              if (message.metadata) {
                Object.assign(response, { metadata: message.metadata });
              }

              await this.writeSocket(socket, codec.encode(response));
              continue;
            }

            const startedAt = Date.now();
            this.activeRequests += 1;

            try {
              const response = await this.invoker.invoke(message);
              if (response.ok) {
                this.logger?.info("rpc server request succeeded", {
                  service: message.service,
                  method: message.method,
                  traceId: message.metadata?.traceId,
                  requestId: message.id,
                  durationMs: Date.now() - startedAt,
                });
              } else {
                this.logger?.error("rpc server request failed", {
                  service: message.service,
                  method: message.method,
                  traceId: message.metadata?.traceId,
                  requestId: message.id,
                  durationMs: Date.now() - startedAt,
                  errorCode: response.error?.code,
                });
              }
              await this.writeSocket(socket, codec.encode(response));
            } finally {
              this.activeRequests -= 1;
              this.resolveDrainIfIdle();
            }
            continue;
          }
          if (message.type === "ping") {
            socket.write(
              codec.encode({
                type: "pong",
                id: message.id,
                timestamp: Date.now(),
              }),
            );
            continue;
          }
        }
      } catch (error) {
        this.logger?.warn("rpc server closing invalid socket", {
          errorMessage: error instanceof Error ? error.message : String(error),
        });

        socket.destroy();
      }
    });
  }

  private closeServer(server: Server): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  private writeSocket(socket: Socket, payload: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      socket.write(payload, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  private waitForActiveRequests(timeoutMs: number): Promise<void> {
    if (this.activeRequests === 0) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.removeDrainResolver(resolve);
        resolve();
      }, timeoutMs);

      const resolver = () => {
        clearTimeout(timer);
        resolve();
      };

      this.drainResolvers.push(resolver);
    });
  }

  private resolveDrainIfIdle(): void {
    if (this.activeRequests !== 0) {
      return;
    }

    const resolvers = this.drainResolvers.splice(0);
    for (const resolve of resolvers) {
      resolve();
    }
  }

  private removeDrainResolver(resolver: () => void): void {
    this.drainResolvers = this.drainResolvers.filter((item) => item !== resolver);
  }
}
