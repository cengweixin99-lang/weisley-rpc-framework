import { RpcClient } from "@weisley-rpc/core";
import type { UserService } from "./share/user-service.js";

const client = new RpcClient({
  mode: "direct",
  host: "127.0.0.1",
  port: 4000,
  timeoutMs: 3000,
  heartbeatIntervalMs: 1000,
  heartbeatTimeoutMs: 3000,
  maxBodyLength: 1024 * 1024,
  maxDecompressedBodyLength: 1024 * 1024,
});

await client.connect();

const userService = client.createProxy<UserService>("UserService");

console.log(await userService.getUser(1));
console.log(await userService.listUsers());
const profile = await userService.getLargeProfile(1);
console.log({
  id: profile.id,
  bioLength: profile.bio.length,
});

client.close();
