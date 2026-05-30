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
};

const server = new RpcServer();
server.registerService("UserService", userService);

await server.listen({ host: "127.0.0.1", port: 4000 });
console.log("RPC server listening on 127.0.0.1:4000");
