import { createServer, type AddressInfo, type Server, type Socket } from "node:net";
import { RpcCodec, type RpcRequest } from "@weisley-rpc/protocol";
import type { RpcServerOptions, ServiceImplementation } from "../types.js";
import { MethodInvoker } from "./method-invoker.js";
import { ServiceRegistry } from "./service-registry.js";

export class RpcServer {
  private readonly registry = new ServiceRegistry();
  private readonly invoker = new MethodInvoker(this.registry);
  private server: Server | null = null;

  registerService(serviceName: string, implementation: ServiceImplementation): void {
    this.registry.register(serviceName, implementation);
  }

  async listen(options: RpcServerOptions): Promise<void> {
    this.server = createServer((socket) => this.handleConnection(socket));

    await new Promise<void>((resolve, reject) => {
      this.server?.once("error", reject);
      this.server?.listen(options.port, options.host ?? "127.0.0.1", resolve);
    });
  }

  address(): AddressInfo | null {
    const address = this.server?.address();
    if (!address || typeof address === "string") {
      return null;
    }

    return address;
  }

  async close(): Promise<void> {
    if (!this.server) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      this.server?.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  private handleConnection(socket: Socket): void {
   
      const codec = new RpcCodec();

      socket.on("data", async (chunk) => {
        try{
          const messages = codec.push(chunk);
          
          for (const message of messages) {
            if(message.type === "request") {
              const response = await this.invoker.invoke(message);
              socket.write(codec.encode(response));
            }
            if(message.type === "ping") {
              socket.write(
                codec.encode({
                  type: "pong",
                  id: message.id,
                  timestamp: Date.now(),
                }),
              );
            }
            }
          } catch {
            socket.destroy();
          }
      });
    } 
}
