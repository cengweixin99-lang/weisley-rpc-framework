export type RpcRequest = {
  type: "request";
  id: string;
  service: string;
  method: string;
  params: unknown[];
  meta?: Record<string, string>;
};

export type RpcResponse = {
  type: "response";
  id: string;
  ok: boolean;
  result?: unknown;
  error?: {
    code: string;
    message: string;
    stack?: string;
  };
};

export type RpcPing = {
  type: "ping";
  id: string;
  timestamp: number;
};

export type RpcPong = {
  type: "pong";
  id: string;
  timestamp: number;
};

export type RpcMessage = RpcRequest | RpcResponse | RpcPing | RpcPong;

export interface Serializer {
  serialize(message: RpcMessage): Buffer;
  deserialize(buffer: Buffer): RpcMessage;
}
