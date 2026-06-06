import { RpcError } from "../errors.js";
export interface RetryPolicy {
    shouldRetry(error: unknown): boolean;
}

export class DefaultRetryPolicy implements RetryPolicy {
    private readonly retryableRpcCodes = new Set([
        "CONNECTION_CLOSED",
        "CONNECTION_NOT_OPEN",
        "CONNECTION_NOT_CONNECTED",
        "RPC_TIMEOUT",
        "HEARTBEAT_TIMEOUT",
    ]);

    private readonly retryableNodeCodes = new Set([
        "ECONNREFUSED",
        "ECONNRESET",
        "ETIMEOUT",
        "EPIPE",
    ]);

    shouldRetry(error: unknown): boolean {
        if (error instanceof RpcError) {
            return this.retryableRpcCodes.has(error.code);
        }
        if (error && typeof error === "object" && "code" in error) {
            return this.retryableNodeCodes.has(String(error.code));
        }

        return false;
    }
}