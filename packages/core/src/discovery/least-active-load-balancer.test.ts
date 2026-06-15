import { describe, expect, it } from "vitest";
import { LeastActiveLoadBalancer } from "./least-active-load-balancer.js";
describe("LeastActiveLoadBalancer", () => {
    it("selects endpoint with the least active count", () => {
        const loadBalancer = new LeastActiveLoadBalancer();
        const endpoints = [
            { host: "127.0.0.1", port: 4000 },
            { host: "127.0.0.1", port: 4001 },
            { host: "127.0.0.1", port: 4002 },
        ];
        loadBalancer.setActiveCount(endpoints[0]!, 5);
        loadBalancer.setActiveCount(endpoints[1]!, 1);
        loadBalancer.setActiveCount(endpoints[2]!, 3);
        expect(loadBalancer.select("UserService", endpoints)).toEqual(endpoints[1]);
    });

    it("uses active count 0 by default", () => {
        const loadBalancer = new LeastActiveLoadBalancer();
        const endpoints = [
            { host: "127.0.0.1", port: 4000 },
            { host: "127.0.0.1", port: 4001 },
        ];
        loadBalancer.setActiveCount(endpoints[0]!, 2);
        expect(loadBalancer.select("UserService", endpoints)).toEqual(endpoints[1]);
    });
    it("select first endpoint when active counts are tied", () => {
        const loadBalancer = new LeastActiveLoadBalancer();
        const endpoints = [
            { host: "127.0.0.1", port: 4000 },
            { host: "127.0.0.1", port: 4001 },
        ];
        loadBalancer.setActiveCount(endpoints[0]!, 1);
        loadBalancer.setActiveCount(endpoints[1]!, 1);

        expect(loadBalancer.select("UserService", endpoints)).toEqual(endpoints[0]);
    });
    it("normalizes negative active count to 0", () => {
        const loadBalancer = new LeastActiveLoadBalancer();
        const endpoint = { host: "127.0.0.1", port: 4000 };
        loadBalancer.setActiveCount(endpoint, -1);
        expect(loadBalancer.getActiveCount(endpoint)).toBe(0);
    });

    it("throws when endpoints are empty", () => {
        const loadBalancer = new LeastActiveLoadBalancer();
        expect(() => loadBalancer.select("UserService", [])).toThrow(
            "No endpoints available",
        );
    });
});