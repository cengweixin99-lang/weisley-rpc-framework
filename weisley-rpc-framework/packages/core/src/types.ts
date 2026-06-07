import type { LoadBalancer, Registry } from "./discovery/types.js";
import type { RetryPolicy } from "./client/retry-policy.js";
export type ServiceImplementation = Record<string, (...args: any[]) => unknown | Promise<unknown>>;

export type CommonRpcClientOptions = {
  timeoutMs?: number;
  heartbeatIntervalMs?: number;
  heartbeatTimeoutMs?: number;
  reconnect?: boolean;
  reconnectInitialDelayMs?: number;
  reconnectMaxDelayMs?: number;
  retryPolicy?: RetryPolicy;
  maxConnectionsPerEndpoint?: number;
};

export type DirectRpcClientOptions = CommonRpcClientOptions & {
  mode: "direct";
  host: string;
  port: number;
};

export type DiscoveryRpcClientOptions
= CommonRpcClientOptions & {
  mode: "discovery";
  registry: Registry;
  loadBalancer: LoadBalancer;
};

export type RpcClientOptions = DirectRpcClientOptions | DiscoveryRpcClientOptions;

export type RpcServerOptions = {
  host?: string;
  port: number;
};

export type ConnectionState = "idle" | "connecting" | "connected" | "reconnecting" | "closed";
