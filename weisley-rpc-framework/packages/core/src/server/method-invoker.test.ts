import { describe, expect, it } from "vitest";
import type { RpcRequest } from "@weisley-rpc/protocol";
import { ServiceRegistry } from "./service-registry.js";
import { MethodInvoker } from "./method-invoker.js";

describe("MethodInvoker", () => {
  it("invokes async service method and returns success response", async () => {
    const registry = new ServiceRegistry();
    const invoker = new MethodInvoker(registry);

    registry.register("UserService", {
      async getUser(id: number) {
        return { id, name: "Alice" };
      },
    });

    const request: RpcRequest = {
      type: "request",
      id: "req-1",
      service: "UserService",
      method: "getUser",
      params: [1],
    };

    const response = await invoker.invoke(request);

    expect(response).toEqual({
      type: "response",
      id: "req-1",
      ok: true,
      result: { id: 1, name: "Alice" },
    });
  });

  it("invokes sync service method and returns success response", async () => {
    const registry = new ServiceRegistry();
    const invoker = new MethodInvoker(registry);

    registry.register("MathService", {
      add(a: number, b: number) {
        return a + b;
      },
    });
    const request: RpcRequest = {
      type: "request",
      id: "req-2",
      service: "MathService",
      method: "add",
      params: [1, 2],
    };
    const response = await invoker.invoke(request);

    expect(response).toEqual({
      type: "response",
      id: "req-2",
      ok: true,
      result: 3,
    });
  });

  it("returns RpcError response when service method is missing", async () => {
    const registry = new ServiceRegistry();
    const invoker = new MethodInvoker(registry);

    const request: RpcRequest = {
      type: "request",
      id: "req-3",
      service: "MissingService",
      method: "getUser",
      params: [],
    };
    const response = await invoker.invoke(request);

    expect(response.ok).toBe(false);
    expect(response.id).toBe("req-3");
    expect(response.error?.code).toBe("SERVICE_NOT_FOUND");
  });

  it("returns internal error response when service throws normal error", async () => {
    const registry = new ServiceRegistry();
    const invoker = new MethodInvoker(registry);

    registry.register("UserService", {
      async getUser() {
        throw new Error("database failed");
      },
    });
    const request: RpcRequest = {
      type: "request",
      id: "req-4",
      service: "UserService",
      method: "getUser",
      params: [],
    }
    const response = await invoker.invoke(request);

    expect(response.ok).toBe(false);
    expect(response.id).toBe("req-4");
    expect(response.error?.code).toBe("INTERNAL_ERROR");
    expect(response.error?.message).toBe("database failed");
  });
});