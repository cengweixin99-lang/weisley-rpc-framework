import { describe, expect, it } from "vitest";
import { TokenBucketRateLimiter } from "./rate-limiter.js";

describe("RateLimiter", () => {
    it("starts with full capacity", () => {
        const limiter = new TokenBucketRateLimiter({
            capacity: 2,
            refillTokens: 1,
            refillIntervalMs: 100,
        });
        expect(limiter.getAvailableTokens()).toBe(2);
    });

    it("allows requests while tokens are availavle", () => {
        const limiter = new TokenBucketRateLimiter({
            capacity: 2,
            refillTokens: 1,
            refillIntervalMs: 100,
        });
        expect(limiter.allow()).toBe(true);
        expect(limiter.allow()).toBe(true);
        expect(limiter.getAvailableTokens()).toBe(0);
    });

    it("rejects requests when tokens are exhausted", () => {
        const limiter = new TokenBucketRateLimiter({
            capacity: 1,
            refillTokens: 1,
            refillIntervalMs: 100,
        });
        expect(limiter.allow()).toBe(true);
        expect(limiter.allow()).toBe(false);
    });
    
    it("refills tokens after interval", async () => {
        const limiter = new TokenBucketRateLimiter({
            capacity: 2,
            refillTokens: 1,
            refillIntervalMs: 10,
        });
        expect(limiter.allow()).toBe(true);
        expect(limiter.allow()).toBe(true);
        expect(limiter.allow()).toBe(false);

        await new Promise((resolve) => setTimeout(resolve, 15));
        expect(limiter.allow()).toBe(true);
    });

    it("does not refill above capacity", async () => {
        const limiter = new TokenBucketRateLimiter({
            capacity: 2,
            refillTokens: 10,
            refillIntervalMs: 10,
        });
        expect(limiter.allow()).toBe(true);
        await new Promise((resolve) => setTimeout(resolve, 35));
        expect(limiter.getAvailableTokens()).toBe(2);
    })

    it("normalizes invalid options", () => {
        const limiter = new TokenBucketRateLimiter({
            capacity: 0,
            refillTokens: 0,
            refillIntervalMs: 0,
        });
        expect(limiter.getAvailableTokens()).toBe(1);
    })
})