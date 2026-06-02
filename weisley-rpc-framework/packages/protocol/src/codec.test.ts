import { describe, expect, it } from "vitest";
import { RpcCodec } from "./codec.js";
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
});