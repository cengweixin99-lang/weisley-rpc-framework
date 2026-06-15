import { RpcServer } from "@weisley-rpc/core";
import type { UserService } from "./share/user-service.js";

const userService: UserService = {
  async getUser(id) {
    return {
      id,
      name: id === 1 ? "Alice" : "Unknown",
    };
  },

  async listUsers() {
    return [
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" },
    ];
  },

  async getLargeProfile(id) {
    return {
      id,
      bio: "A".repeat(4096),
    };
  },
};

const server = new RpcServer();
server.registerService("UserService", userService);

await server.listen({
  host: "127.0.0.1",
  port: 4000,
  maxBodyLength: 1024 * 1024,
  maxDecompressedBodyLength: 1024 * 1024,
});

console.log("RPC server listening on 127.0.0.1:4000");

process.once("SIGINT", async () => {
  console.log("Gracefully shutting down RPC server...");
  await server.close({ graceful: true, timeoutMs: 3000 });
  process.exit(0);
});
