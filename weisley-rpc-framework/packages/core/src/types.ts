export type ServiceImplementation = Record<string, (...args: any[]) => unknown | Promise<unknown>>;

export type RpcClientOptions = {
  host: string;
  port: number;
  timeoutMs?: number;
  heartbeatIntervalMs?: number;
  heartbeatTimeoutMs?: number;
  reconnect?: boolean;
  reconnectInitialDelayMs?: number;
  reconnectMaxDelayMs?: number;
};

export type RpcServerOptions = {
  host?: string;
  port: number;
};

export type ConnectionState = "idle" | "connecting" | "connected" | "reconnecting" | "closed";
