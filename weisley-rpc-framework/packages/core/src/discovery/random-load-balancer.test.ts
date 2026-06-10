import { describe, expect, it, vi } from "vitest";
import { RandomLoadBalancer } from "./random-load-balancer.js";

describe("RandomLoadBalancer", () => {
  it("selects an endpoint by random index", () => {
    const loadBalancer = new RandomLoadBalancer();
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.75);

    const endpoints = [
      { host: "127.0.0.1", port: 4000 },
      { host: "127.0.0.1", port: 4001 },
      { host: "127.0.0.1", port: 4002 },
      { host: "127.0.0.1", port: 4003 },
    ];

    expect(loadBalancer.select("UserService", endpoints)).toEqual(endpoints[3]);

    randomSpy.mockRestore();
  });

  it("returns the only endpoint when there is one endpoint", () => {
    const loadBalancer = new RandomLoadBalancer();
    const endpoints = [{ host: "127.0.0.1", port: 4000 }];

    expect(loadBalancer.select("UserService", endpoints)).toEqual(endpoints[0]);
  });

  it("throws when endpoints are empty", () => {
    const loadBalancer = new RandomLoadBalancer();

    expect(() => loadBalancer.select("UserService", [])).toThrow(
      "No endpoints available",
    );
  });
});
