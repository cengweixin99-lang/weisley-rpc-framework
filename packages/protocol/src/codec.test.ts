import { describe, expect, it } from "vitest";
import { PACKET_FLAG_COMPRESSED } from "./constants.js";
import { RpcCodec } from "./codec.js";
import { GzipCompressor } from "./compressor.js";
import { decodePacketHeader } from "./packet.js";
import { ProtobufSerializer } from "./protobuf-serializer.js";
import type { RpcRequest } from "./types.js";

describe("RpcCodec", () => {
    // encode 可以把 RpcRequest 编码成 packet
  it("encodes and decodes a complete message", () => {
    const codec = new RpcCodec();

    const request: RpcRequest = {
      type: "request",
      id: "req-1",
      service: "UserService",
      method: "getUser",
      params: [1],
    };

    const packet = codec.encode(request);
    const messages = codec.push(packet);

    expect(messages).toEqual([request]);
  });

    // push 一个完整 packet 可以解出 RpcRequest
  it("returns empty array when packet is incomplete", () => {
    const encoder = new RpcCodec();
    const decoder = new RpcCodec();

    const request: RpcRequest = {
      type: "request",
      id: "req-1",
      service: "UserService",
      method: "getUser",
      params: [1],
    };

    const packet = encoder.encode(request);
    const firstHalf = packet.subarray(0, 3);

    expect(decoder.push(firstHalf)).toEqual([]);
  });

  // 一个 packet 拆成多段 push ，最后能解出 RpcRequest
  it("decodes message split across multiple chunks", () => {
    const encoder = new RpcCodec();
    const decoder = new RpcCodec();

    const request: RpcRequest = {
      type: "request",
      id: "req-1",
      service: "UserService",
      method: "getUser",
      params: [1],
    };

    const packet = encoder.encode(request);

    expect(decoder.push(packet.subarray(0, 2))).toEqual([]);
    expect(decoder.push(packet.subarray(2, 7))).toEqual([]);
    expect(decoder.push(packet.subarray(7))).toEqual([request]);
  });

  // 多个 packet 粘在一起 push，可以一次解出多个 RpcRequest
  it("decodes multiple messages from a sticky packet", () => {
    const encoder = new RpcCodec();
    const decoder = new RpcCodec();

    const request1: RpcRequest = {
      type: "request",
      id: "req-1",
      service: "UserService",
      method: "getUser",
      params: [1],
    };

    const request2: RpcRequest = {
      type: "request",
      id: "req-2",
      service: "UserService",
      method: "getUser",
      params: [2],
    };

    const stickyPacket = Buffer.concat([
      encoder.encode(request1),
      encoder.encode(request2),
    ]);

    expect(decoder.push(stickyPacket)).toEqual([request1, request2]);
  });

  it("encodes and decodes message with protobuf serializer", () => {
    const codec = new RpcCodec(new ProtobufSerializer());

    const request: RpcRequest = {
      type: "request",
      id: "req-1",
      service: "UserService",
      method: "getUser",
      params: [1],
      metadata: {
        traceId: "trace-protobuf",
      },
    };

    const packet = codec.encode(request);

    expect(codec.push(packet)).toEqual([request]);
  });

  it("does not compress payload below threshold", () => {
    const codec = new RpcCodec({
      compression: {
        compressor: new GzipCompressor(),
        thresholdBytes: 1024,
      },
    });

    const packet = codec.encode({
      type: "request",
      id: "req-1",
      service: "UserService",
      method: "getUser",
      params: [1],
    });

    const header = decodePacketHeader(packet);
    expect(header.flags & PACKET_FLAG_COMPRESSED).toBe(0);
    expect(codec.push(packet)).toEqual([
      {
        type: "request",
        id: "req-1",
        service: "UserService",
        method: "getUser",
        params: [1],
      },
    ]);
  });

  it("compresses payload at or above threshold", () => {
    const codec = new RpcCodec({
      compression: {
        compressor: new GzipCompressor(),
        thresholdBytes: 1,
      },
    });

    const request: RpcRequest = {
      type: "request",
      id: "req-1",
      service: "UserService",
      method: "upload",
      params: ["x".repeat(2048)],
    };
    const packet = codec.encode(request);

    const header = decodePacketHeader(packet);
    expect(header.flags & PACKET_FLAG_COMPRESSED).toBe(PACKET_FLAG_COMPRESSED);
    expect(codec.push(packet)).toEqual([request]);
  });

  it("throws when compressed packet is received without compressor", () => {
    const encoder = new RpcCodec({
      compression: {
        compressor: new GzipCompressor(),
        thresholdBytes: 1,
      },
    });
    const decoder = new RpcCodec();
    const packet = encoder.encode({
      type: "request",
      id: "req-1",
      service: "UserService",
      method: "upload",
      params: ["x".repeat(2048)],
    });

    expect(() => decoder.push(packet)).toThrow(RangeError);
  });

  it("throws when serialized body exceeds max body length", () => {
    const codec = new RpcCodec({
      maxBodyLength: 32,
    });

    expect(() =>
      codec.encode({
        type: "request",
        id: "req-1",
        service: "UserService",
        method: "upload",
        params: ["x".repeat(128)],
      }),
    ).toThrow(RangeError);
  });

  it("throws when decompressed body exceeds max decompressed body length", () => {
    const encoder = new RpcCodec({
      compression: {
        compressor: new GzipCompressor(),
        thresholdBytes: 1,
      },
      maxBodyLength: 1024,
      maxDecompressedBodyLength: 1024,
    });
    const decoder = new RpcCodec({
      compression: {
        compressor: new GzipCompressor(),
        thresholdBytes: 1,
      },
      maxBodyLength: 1024,
      maxDecompressedBodyLength: 64,
    });

    const packet = encoder.encode({
      type: "request",
      id: "req-1",
      service: "UserService",
      method: "upload",
      params: ["x".repeat(512)],
    });

    expect(() => decoder.push(packet)).toThrow(RangeError);
  });

  it("throws when body length limit is invalid", () => {
    expect(() => new RpcCodec({ maxBodyLength: 0 })).toThrow(RangeError);
    expect(() => new RpcCodec({ maxDecompressedBodyLength: -1 })).toThrow(
      RangeError,
    );
  });
});
