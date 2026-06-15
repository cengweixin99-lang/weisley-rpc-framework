import { describe, expect, it } from "vitest";
import { ProtobufSerializer } from "./protobuf-serializer.js";
import type { RpcMessage } from "./types.js";

describe("ProtobufSerializer", () => {
  it("serializes and deserializes request message", () => {
    const serializer = new ProtobufSerializer();

    const message: RpcMessage = {
      type: "request",
      id: "req-1",
      service: "UserService",
      method: "getUser",
      params: [1, { includeProfile: true }],
      metadata: {
        traceId: "trace-1",
      },
    };

    expect(serializer.deserialize(serializer.serialize(message))).toEqual(message);
  });

  it("serializes and deserializes successful response message", () => {
    const serializer = new ProtobufSerializer();

    const message: RpcMessage = {
      type: "response",
      id: "req-1",
      ok: true,
      result: {
        id: 1,
        name: "Alice",
      },
      metadata: {
        traceId: "trace-1",
      },
    };

    expect(serializer.deserialize(serializer.serialize(message))).toEqual(message);
  });

  it("serializes and deserializes failed response message", () => {
    const serializer = new ProtobufSerializer();

    const message: RpcMessage = {
      type: "response",
      id: "req-1",
      ok: false,
      error: {
        code: "METHOD_NOT_FOUND",
        message: "method not found",
      },
      metadata: {
        traceId: "trace-1",
      },
    };

    expect(serializer.deserialize(serializer.serialize(message))).toEqual(message);
  });

  it("serializes and deserializes ping and pong messages", () => {
    const serializer = new ProtobufSerializer();

    const ping: RpcMessage = {
      type: "ping",
      id: "ping-1",
      timestamp: 100,
    };

    const pong: RpcMessage = {
      type: "pong",
      id: "pong-1",
      timestamp: 200,
    };

    expect(serializer.deserialize(serializer.serialize(ping))).toEqual(ping);
    expect(serializer.deserialize(serializer.serialize(pong))).toEqual(pong);
  });
});
