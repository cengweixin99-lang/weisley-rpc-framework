export type RpcLogFields = Record<string, unknown>;
export interface RpcLogger {
    info(message: string, fields?: RpcLogFields): void;
    warn(message: string, fields?: RpcLogFields): void;
    error(message: string, fields?: RpcLogFields): void;
}