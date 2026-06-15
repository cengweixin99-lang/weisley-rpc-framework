import type { Endpoint } from "../discovery/types.js";
import { RpcError } from "../errors.js";

export interface RetryPolicy {
    shouldRetry(error: unknown, context: RetryContext): boolean;
}
export type RetryContext = {
    serviceName: string;
    method: string;
    attempt: number;
    maxAttempts: number;
    endpoint: Endpoint;
    errorCode?: string | undefined;
}

export class DefaultRetryPolicy implements RetryPolicy {
    private readonly retryableRpcCodes = new Set([
        "CONNECTION_CLOSED",
        "CONNECTION_NOT_OPEN",
        "CONNECTION_NOT_CONNECTED",
        "RPC_TIMEOUT",
        "HEARTBEAT_TIMEOUT",
        "SERVER_DRAINING",
    ]);

    private readonly retryableNodeCodes = new Set([
        "ECONNREFUSED",
        "ECONNRESET",
        "ETIMEDOUT",
        "EPIPE",
    ]);

    shouldRetry(error: unknown, _context: RetryContext): boolean {
        if (error instanceof RpcError) {
            return this.retryableRpcCodes.has(error.code);
        }
        if (error && typeof error === "object" && "code" in error) {
            return this.retryableNodeCodes.has(String(error.code));
        }

        return false;
    }
}
