import { RpcClient } from "@weisley-rpc/core";
import type { UserService } from "./share/user-service.js";

const client = new RpcClient({
  host: "127.0.0.1",
  port: 4000,
  timeoutMs: 3000,
  heartbeatIntervalMs: 1000,
  heartbeatTimeoutMs: 3000,
});

await client.connect();

const userService = client.createProxy<UserService>("UserService");

console.log(await userService.getUser(1));
console.log(await userService.listUsers());

client.close();
