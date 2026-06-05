import { describe, expect, it } from "vitest";
import { RoundRobinLoadBalancer } from "./round-robin-load-balancer.js";

describe("RoundRobinLoadBalancer", () => {
  it("selects endpoints in round-robin order", () => {
    const loadBalancer = new RoundRobinLoadBalancer();

    const endpoints = [
      { host: "127.0.0.1", port: 4000 },
      { host: "127.0.0.1", port: 4001 },
    ];

    expect(loadBalancer.select("UserService", endpoints)).toEqual(endpoints[0]);
    expect(loadBalancer.select("UserService", endpoints)).toEqual(endpoints[1]);
    expect(loadBalancer.select("UserService", endpoints)).toEqual(endpoints[0]);
  });

  it("keeps independent cursor for each service", () => {
    const loadBalancer = new RoundRobinLoadBalancer();

    const userEndpoints = [
      { host: "127.0.0.1", port: 4000 },
      { host: "127.0.0.1", port: 4001 },
    ];

    const orderEndpoints = [
      { host: "127.0.0.1", port: 5000 },
      { host: "127.0.0.1", port: 5001 },
    ];

    expect(loadBalancer.select("UserService", userEndpoints)).toEqual(userEndpoints[0]);
    expect(loadBalancer.select("OrderService", orderEndpoints)).toEqual(orderEndpoints[0]);
    expect(loadBalancer.select("UserService", userEndpoints)).toEqual(userEndpoints[1]);
    expect(loadBalancer.select("OrderService", orderEndpoints)).toEqual(orderEndpoints[1]);
  });

  it("throws when endpoints are empty", () => {
    const loadBalancer = new RoundRobinLoadBalancer();

    expect(() => loadBalancer.select("UserService", [])).toThrow("No endpoints available");
  });
});