import { describe, expect, it } from "vitest";
import { CircuitBreaker } from "./circuit-breaker.js";

/**
 * 熔断单元测试
 */
describe("CircuitBreaker", () => {
    // 测试1：初始状态 closed，允许请求
    it("starts closed and allows requests", () => {
        const breaker = new CircuitBreaker({
            failureThreshold: 2,
            resetTimeoutMs: 100,
        });
        expect(breaker.getState("UserService.getUser")).toBe("closed");
        expect(breaker.canRequest("UserService.getUser")).toBe(true);
    })

    // 测试2：连续失败达到阈值后 open
    it("opens after failure threshold is reached", () => {
        const breaker = new CircuitBreaker({
            failureThreshold: 2,
            resetTimeoutMs: 100,
        });

        breaker.recordFailure("UserService.getUser");
        expect(breaker.getState("UserService.getUser")).toBe("closed");

        breaker.recordFailure("UserService.getUser");
        expect(breaker.getState("UserService.getUser")).toBe("open");
        expect(breaker.canRequest("UserService.getUser")).toBe(false);
    })

    // 测试 3：open 后 resetTimeoutMs 之前拒绝请求。
    it("rejects requests while open before reset timeout", () => {
        const breaker = new CircuitBreaker({
            failureThreshold: 1,
            resetTimeoutMs: 1000,
        });

        breaker.recordFailure("UserService.getUser");

        expect(breaker.getState("UserService.getUser")).toBe("open");
        expect(breaker.canRequest("UserService.getUser")).toBe(false);
    });

    // 测试 4：open 超时后进入 half-open 并允许请求。
    it("moves to half-open after reset timeout", async () => {
        const breaker = new CircuitBreaker({
            failureThreshold: 1,
            resetTimeoutMs: 10,
        });

        breaker.recordFailure("UserService.getUser");

        await new Promise((resolve) => setTimeout(resolve, 15));

        expect(breaker.canRequest("UserService.getUser")).toBe(true);
        expect(breaker.getState("UserService.getUser")).toBe("half-open");
    });

    // 测试 5：half-open 成功后 closed。
    it("closes after successful half-open probe", async () => {
        const breaker = new CircuitBreaker({
            failureThreshold: 1,
            resetTimeoutMs: 10,
        });

        breaker.recordFailure("UserService.getUser");

        await new Promise((resolve) => setTimeout(resolve, 15));

        expect(breaker.canRequest("UserService.getUser")).toBe(true);

        breaker.recordSuccess("UserService.getUser");

        expect(breaker.getState("UserService.getUser")).toBe("closed");
    });

    // 测试 6：half-open 失败后重新 open。
    it("reopens after failed half-open probe", async () => {
        const breaker = new CircuitBreaker({
            failureThreshold: 1,
            resetTimeoutMs: 10,
        });

        breaker.recordFailure("UserService.getUser");

        await new Promise((resolve) => setTimeout(resolve, 15));

        expect(breaker.canRequest("UserService.getUser")).toBe(true);

        breaker.recordFailure("UserService.getUser");

        expect(breaker.getState("UserService.getUser")).toBe("open");
        expect(breaker.canRequest("UserService.getUser")).toBe(false);
    });

    // 测试 7：成功会重置失败次数。
    it("resets failure count after success", () => {
        const breaker = new CircuitBreaker({
            failureThreshold: 2,
            resetTimeoutMs: 100,
        });

        breaker.recordFailure("UserService.getUser");
        breaker.recordSuccess("UserService.getUser");
        breaker.recordFailure("UserService.getUser");

        expect(breaker.getState("UserService.getUser")).toBe("closed");
    });
});