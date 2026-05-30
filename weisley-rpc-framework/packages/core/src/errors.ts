export class RpcError extends Error {
  constructor(
    message: string,
    public readonly code = "RPC_ERROR",
  ) {
    super(message);
    this.name = "RpcError";
  }
}

export class ServiceNotFoundError extends RpcError {
  constructor(service: string) {
    super(`Service not found: ${service}`, "SERVICE_NOT_FOUND");
  }
}

export class MethodNotFoundError extends RpcError {
  constructor(service: string, method: string) {
    super(`Method not found: ${service}.${method}`, "METHOD_NOT_FOUND");
  }
}

export class RpcTimeoutError extends RpcError {
  constructor(timeoutMs: number) {
    super(`RPC request timed out after ${timeoutMs}ms`, "RPC_TIMEOUT");
  }
}
