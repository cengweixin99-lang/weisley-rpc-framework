export type RpcRequest = {
  type: "request";
  id: string;
  service: string;
  method: string;
  params: unknown[];
  metadata?: RpcMetadata;
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
  metadata?: RpcMetadata;
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
  readonly name: SerializerName;
  serialize(message: RpcMessage): Buffer;
  deserialize(buffer: Buffer): RpcMessage;
}

export type RpcMetadata = Record<string, string>;

export type SerializerName = "json" | "protobuf";
