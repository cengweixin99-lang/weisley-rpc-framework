import protobuf from "protobufjs";
import type { Long } from "protobufjs";
import type {
  RpcMessage,
  RpcPing,
  RpcPong,
  RpcRequest,
  RpcResponse,
  Serializer,
} from "./types.js";

const proto = `
syntax = "proto3";
package weisley.rpc;

message RpcError {
    string code = 1;
    string message = 2;
    string stack = 3;
}

message RpcMessage {
    string type = 1;
    string id = 2;

    string service = 3;
    string method = 4;

    repeated string paramsJson = 5;

    bool ok = 6;
    string resultJson = 7;
    RpcError error = 8;

    int64 timestamp = 9;

    map<string, string> metadata = 10;
}
`;
const root = protobuf.parse(proto).root;
const RpcMessageModel = root.lookupType("weisley.rpc.RpcMessage");

type ProtobufRpcMessage = {
  type: string;
  id: string;
  service?: string;
  method?: string;
  paramsJson?: string[];
  ok?: boolean;
  resultJson?: string;
  error?: {
    code?: string;
    message?: string;
    stack?: string;
  };
  timestamp?: number | Long;
  metadata?: Record<string, string>;
};
export class ProtobufSerializer implements Serializer {
  readonly name = "protobuf" as const;
  serialize(message: RpcMessage): Buffer {
    const payload = this.toProtobufPayload(message);
    const error = RpcMessageModel.verify(payload);

    if (error) {
      throw new Error(`Invalid protobuf RPC message: ${error}`);
    }
    const encoded = RpcMessageModel.encode(payload).finish();
    return Buffer.from(encoded);
  }

  deserialize(buffer: Buffer): RpcMessage {
    const decoded = RpcMessageModel.decode(buffer);
    const object = RpcMessageModel.toObject(decoded, {
      defaults: false,
      longs: Number,
    }) as ProtobufRpcMessage;
    return this.fromProtobufPayload(object);
  }

  private toProtobufPayload(message: RpcMessage): ProtobufRpcMessage {
    if (message.type === "request") {
      const payload: ProtobufRpcMessage = {
        type: message.type,
        id: message.id,
        service: message.service,
        method: message.method,
        paramsJson: message.params.map((param) => JSON.stringify(param)),
      };

      if (message.metadata) {
        payload.metadata = message.metadata;
      }

      return payload;
    }

    if (message.type === "response") {
      const payload: ProtobufRpcMessage = {
        type: message.type,
        id: message.id,
        ok: message.ok,
      };

      if (message.result !== undefined) {
        payload.resultJson = JSON.stringify(message.result);
      }

      if (message.error) {
        payload.error = message.error;
      }

      if (message.metadata) {
        payload.metadata = message.metadata;
      }

      return payload;
    }

    return {
      type: message.type,
      id: message.id,
      timestamp: message.timestamp,
    };
  }

  private fromProtobufPayload(payload: ProtobufRpcMessage): RpcMessage {
    if (payload.type === "request") {
      const request: RpcRequest = {
        type: "request",
        id: payload.id,
        service: payload.service ?? "",
        method: payload.method ?? "",
        params: (payload.paramsJson ?? []).map((param): unknown =>
          JSON.parse(param),
        ),
      };

      if (payload.metadata) {
        request.metadata = payload.metadata;
      }

      return request;
    }

    if (payload.type === "response") {
      const response: RpcResponse = {
        type: "response",
        id: payload.id,
        ok: payload.ok ?? false,
      };

      if (payload.resultJson !== undefined) {
        response.result = JSON.parse(payload.resultJson) as unknown;
      }

      if (payload.error) {
        response.error = {
          code: payload.error.code ?? "",
          message: payload.error.message ?? "",
        };

        if (payload.error.stack !== undefined) {
          response.error.stack = payload.error.stack;
        }
      }

      if (payload.metadata) {
        response.metadata = payload.metadata;
      }

      return response;
    }

    if (payload.type === "ping") {
      return {
        type: "ping",
        id: payload.id,
        timestamp: Number(payload.timestamp ?? 0),
      } satisfies RpcPing;
    }

    if (payload.type === "pong") {
      return {
        type: "pong",
        id: payload.id,
        timestamp: Number(payload.timestamp ?? 0),
      } satisfies RpcPong;
    }
    throw new Error(`Unknown protobuf RPC message type: ${payload.type}`);
  }
}
