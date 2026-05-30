import { describe, expect, it } from "vitest";
import { MethodNotFoundError, ServiceNotFoundError } from "../errors.js";
import { ServiceRegistry } from "./service-registry.js";

describe("ServiceRegistry", () => {
  it("registers a service and returns a bound method", async () => {
    const registry = new ServiceRegistry();
    const prefix = "user";

    const userService = {
      async getUser(id: number) {
        return {
          id,
          name: `${prefix}-${id}`,
        };
      },
    };

    registry.register("UserService", userService);

    const method = registry.getMethod("UserService", "getUser");
    const result = await method(1);

    expect(result).toEqual({
      id: 1,
      name: "user-1",
    });
  });

  it("throws ServiceNotFoundError when service does not exist", () => {
    const registry = new ServiceRegistry();

    expect(() => registry.getMethod("MissingService", "getUser")).toThrow(ServiceNotFoundError);
  });

  it("throws MethodNotFoundError when method does not exist", () => {
    const registry = new ServiceRegistry();

    registry.register("UserService", {
      async getUser(id: number) {
        return { id };
      },
    });

    expect(() => registry.getMethod("UserService", "missingMethod")).toThrow(MethodNotFoundError);
  });
});