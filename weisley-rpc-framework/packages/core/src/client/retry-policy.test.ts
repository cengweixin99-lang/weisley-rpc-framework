import { describe , expect, it } from "vitest";
import { DefaultRetryPolicy } from "./retry-policy.js";
import { MethodNotFoundError, RpcError, RpcTimeoutError } from "../errors.js";
describe("DefaultRetryPolicy", () => {
    it ("retries retryable rpc errors", () => {
        const policy = new DefaultRetryPolicy();
        expect(policy.shouldRetry(new RpcTimeoutError(100))).toBe(true);
        expect(policy.shouldRetry(new RpcError("Connection closed", "CONNECTION_CLOSED"))).toBe(true);
    });

    it ("does not retry non-retryable rpc errors", () => {
        const policy = new DefaultRetryPolicy();
        expect(policy.shouldRetry(new MethodNotFoundError("UserService", "missingMethod"))).toBe(false);

    });
    
    it ("retries retryable node socket errors", () => {
        const policy = new DefaultRetryPolicy();
        expect(policy.shouldRetry(Object.assign(new Error("refused"), { code: "ECONNREFUSED" }))).toBe(true);
        expect(policy.shouldRetry(Object.assign(new Error("reset"), { code: "ECONNRESET" }))).toBe(true);
    });
})