export type ServiceImplementation = Record<string, (...args: any[]) => unknown | Promise<unknown>>;

export type RpcClientOptions = {
  host: string;
  port: number;
  timeoutMs?: number;
};

export type RpcServerOptions = {
  host?: string;
  port: number;
};
