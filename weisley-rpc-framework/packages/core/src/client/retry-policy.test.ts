import { describe , expect, it } from "vitest";
import { DefaultRetryPolicy, type RetryContext } from "./retry-policy.js";
import { MethodNotFoundError, RpcError, RpcTimeoutError } from "../errors.js";

const context: RetryContext = {
    serviceName: "UserService",
    method: "getUser",
    attempt: 1,
    maxAttempts: 2,
    endpoint: {
        host: "127.0.0.1",
        port: 4000,
    },
    errorCode: "RPC_TIMEOUT",
};

describe("DefaultRetryPolicy", () => {
    it ("retries retryable rpc errors", () => {
        const policy = new DefaultRetryPolicy();
        expect(policy.shouldRetry(new RpcTimeoutError(100), context)).toBe(true);
        expect(policy.shouldRetry(new RpcError("Connection closed", "CONNECTION_CLOSED"), context)).toBe(true);
    });

    it ("does not retry non-retryable rpc errors", () => {
        const policy = new DefaultRetryPolicy();
        expect(policy.shouldRetry(new MethodNotFoundError("UserService", "missingMethod"), context)).toBe(false);

    });
    
    it ("retries retryable node socket errors", () => {
        const policy = new DefaultRetryPolicy();
        expect(policy.shouldRetry(Object.assign(new Error("refused"), { code: "ECONNREFUSED" }), context)).toBe(true);
        expect(policy.shouldRetry(Object.assign(new Error("reset"), { code: "ECONNRESET" }), context)).toBe(true);
    });
})