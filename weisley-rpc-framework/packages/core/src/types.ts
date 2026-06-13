import type { LoadBalancer, Registry } from "./discovery/types.js";
import type { RetryPolicy } from "./client/retry-policy.js";
import type { CircuitBreakerOptions } from "./client/circuit-breaker.js";
import type { RateLimiterOptions } from "./client/rate-limiter.js";
import type {
  RpcCodecCompressionOptions,
  RpcMetadata,
  Serializer,
} from "@weisley-rpc/protocol";
import type { RpcLogger } from "./logger.js";

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
  retryMaxAttempts?: number;
  retryInitialBackoffMs?: number;
  retryMaxBackoffMs?: number;
  retryRules?: RetryRules;
  circuitBreakerOptions?: CircuitBreakerOptions ;
  rateLimiterOptions?: RateLimiterOptions;
  logger?: RpcLogger;
  serializer?: Serializer;
  compression?: RpcCodecCompressionOptions;
  maxBodyLength?: number;
  maxDecompressedBodyLength?: number;
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
  logger?: RpcLogger;
  serializer?: Serializer;
  compression?: RpcCodecCompressionOptions;
  maxBodyLength?: number;
  maxDecompressedBodyLength?: number;
};

export type ConnectionState = "idle" | "connecting" | "connected" | "reconnecting" | "closed";
export type ConnectionStateStats = Record<ConnectionState, number>;

export type EndpointConnectionStats = {
  total: number;
  states: ConnectionStateStats;
};
export type RpcClientConnectionStats = Record<string, EndpointConnectionStats>;

export type RpcMethodMetrics = {
  totalCalls: number;
  successCalls: number;
  failedCalls: number;
  totalDurationMs: number;
  averageDurationMs: number;
  lastErrorCode?: string | undefined;
};
export type RpcClientMetrics = Record<string, RpcMethodMetrics>;

export type RetryRule = {
  maxAttempts?: number;
  initialBackoffMs?: number;
  maxBackoffMs?: number;
}

export type RetryRules = Record<string, RetryRule>;

export type RpcCallOptions = {
  metadata?: RpcMetadata;
}
