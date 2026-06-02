export type ServiceImplementation = Record<string, (...args: any[]) => unknown | Promise<unknown>>;

export type RpcClientOptions = {
  host: string;
  port: number;
  timeoutMs?: number;
  heartbeatIntervalMs?: number;
  heartbeatTimeoutMs?: number;
};

export type RpcServerOptions = {
  host?: string;
  port: number;
};
