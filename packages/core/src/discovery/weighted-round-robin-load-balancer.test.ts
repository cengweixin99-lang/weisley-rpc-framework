import { describe, expect, it, vi } from "vitest";
import { WeightedRoundRobinLoadBalancer } from "./weighted-round-robin-load-balancer.js";

describe("WeightedRoundRobinLoadBalancer", () => {
    // 按权重选择 endpoint
    it("selects endpoints according to weights", () => {
        const loadBalancer = new WeightedRoundRobinLoadBalancer();
        const endpoints = [ 
            { host: "127.0.0.1", port: 4000, weight: 1 },
            { host: "127.0.0.1", port: 4001, weight: 3 },
        ];
        
        expect(loadBalancer.select("UserService", endpoints)).toEqual(endpoints[0]);
        expect(loadBalancer.select("UserService", endpoints)).toEqual(endpoints[1]);
        expect(loadBalancer.select("UserService", endpoints)).toEqual(endpoints[1]);
        expect(loadBalancer.select("UserService", endpoints)).toEqual(endpoints[1]);
        expect(loadBalancer.select("UserService", endpoints)).toEqual(endpoints[0]);


    });
    
    // 没有 weight 时默认为 1
    it("uses weight 1 by default", () => {
        const loadBalancer = new WeightedRoundRobinLoadBalancer();
        const endpoints = [
            { host: "127.0.0.1", port: 4000 },
            { host: "127.0.0.1", port: 4001 },
        ];
        expect(loadBalancer.select("UserService", endpoints)).toEqual(endpoints[0]);
        expect(loadBalancer.select("UserService", endpoints)).toEqual(endpoints[1]);
        expect(loadBalancer.select("UserService", endpoints)).toEqual(endpoints[0]);
    });

    // 不同 service cursor 独立
    it("keeps independent cursor for each service", () => {
        const loadBalancer = new WeightedRoundRobinLoadBalancer();
        const userEndpoints = [
            { host: "127.0.0.1", port: 4000, weight: 1 },
            { host: "127.0.0.1", port: 4001, weight: 2 },
        ];
        const orderEndpoints = [
            { host: "127.0.0.1", port: 5000, weight: 1 },
            { host: "127.0.0.1", port: 5001, weight: 2 },
        ];
        expect(loadBalancer.select("UserService", userEndpoints)).toEqual(userEndpoints[0]);
        expect(loadBalancer.select("OrderService", orderEndpoints)).toEqual(orderEndpoints[0]);
        expect(loadBalancer.select("UserService", userEndpoints)).toEqual(userEndpoints[1]);
        expect(loadBalancer.select("OrderService", orderEndpoints)).toEqual(orderEndpoints[1]);

    })

    // 空 endpoints 报错
    it("throws when endpoints are empty", () => {
        const loadBalancer = new WeightedRoundRobinLoadBalancer();
        expect(() => loadBalancer.select("UserService", [])).toThrow(
            "No endpoints available",
        );
    });

    // 非法 weight 回退到1
    it("normalizes invalid weight to 1", () => {
        const loadBalancer = new WeightedRoundRobinLoadBalancer();
        const endpoints = [
            { host: "127.0.0.1", port: 4000, weight: 0 },
            { host: "127.0.0.1", port: 4001, weight: -1 },
        ];
        expect(loadBalancer.select("UserService", endpoints)).toEqual(endpoints[0]);
        expect(loadBalancer.select("UserService", endpoints)).toEqual(endpoints[1]);
        expect(loadBalancer.select("UserService", endpoints)).toEqual(endpoints[0]);
    })
});
