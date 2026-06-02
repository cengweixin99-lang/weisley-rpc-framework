import type { RpcRequest, RpcResponse } from "@weisley-rpc/protocol";
import { RpcError } from "../errors.js";
import { ServiceRegistry } from "./service-registry.js";

export class MethodInvoker {
  constructor(private readonly registry: ServiceRegistry) {}

  async invoke(request: RpcRequest): Promise<RpcResponse> {
    try {
      const method = this.registry.getMethod(request.service, request.method);
      const result = await method(...request.params);

      return {
        type: "response",
        id: request.id,
        ok: true,
        result,
      };
    } catch (error) {
      return {
        type: "response",
        id: request.id,
        ok: false,
        error: this.toRpcError(error),
      };
    }
  }

  private toRpcError(error: unknown): NonNullable<RpcResponse["error"]> {
    if (error instanceof RpcError) {
      return {
        code: error.code,
        message: error.message,
      };
    }

    if (error instanceof Error) {
      const rpcError: NonNullable<RpcResponse["error"]> = {
        code: "INTERNAL_ERROR",
        message: error.message,
      };

      if (error.stack) {
        rpcError.stack = error.stack;
      }

      return rpcError;
    }

    return {
      code: "INTERNAL_ERROR",
      message: String(error),
    };
  }
}
