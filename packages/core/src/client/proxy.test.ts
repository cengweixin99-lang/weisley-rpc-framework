import { describe, expect, it, vi } from "vitest";
import { createProxy } from "./proxy.js";
import type { RpcClient } from "./rpc-client.js";

type User = {
    id: number;
    name: string;
};

type UserService = {
    getUser(id: number): Promise<User>;
    listUsers(): Promise<User[]>;
}

describe("createProxy", () => {
    it("converts method call to rpc client call", async () => {
        // vi.fn() 是 Vitest 的 mock 函数，用来假装 client.call
        const call = vi.fn().mockResolvedValue({ id: 1, name: "Alice"});
        const client = {
            call,
        } as unknown as RpcClient;

        const userService = createProxy<UserService>(client, "UserService");
        const result = await userService.getUser(1);
        expect(result).toEqual({ id: 1, name: "Alice" });
        expect(call).toHaveBeenCalledWith("UserService","getUser",[1]);
    });

    it("passes empty args for no-arg methods", async () => {
        const call = vi.fn().mockResolvedValue([{ id: 1, name: "Alice" }]);

        const client = {
          call,
        } as unknown as RpcClient;

        const userService = createProxy<UserService>(client, "UserService");

        const result = await userService.listUsers();

        expect(result).toEqual([{ id: 1, name: "Alice" }]);
        expect(call).toHaveBeenCalledWith("UserService", "listUsers", []);
  });
})