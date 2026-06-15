import type { RpcClient } from "./rpc-client.js";

// 定义一个异步函数类型
type AsyncMethod = (...args: never[]) => Promise<unknown>;

// TypeScript 的映射类型 + 条件类型 + infer
// Await<TResult> 的作用是把 Promise 里面的值拆出来，再套一层 Promise 是因为 RPC 调用一定是异步的
export type RpcProxy<TService> = {
  [K in keyof TService]: TService[K] extends (...args: infer TArgs) => infer TResult
    ? (...args: TArgs) => Promise<Awaited<TResult>>
    : never;
};

export function createProxy<TService extends Record<string, AsyncMethod>>(
  client: RpcClient,
  serviceName: string,
): RpcProxy<TService> {
  // Use JavaScript Proxy to convert method calls into client.call().
 return new Proxy(
  {},
  {
    get(_target, propertyKey) {
      if (typeof propertyKey !== "string") {
        return undefined;
      }
      return (...args: unknown[]) => client.call(serviceName, propertyKey, args);
    },
  },
 ) as RpcProxy<TService>;
}
