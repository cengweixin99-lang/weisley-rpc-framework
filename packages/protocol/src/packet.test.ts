import { describe, expect, it } from "vitest";
import {
  HEADER_LENGTH,
  MAGIC_NUMBER,
  MAX_PACKET_LENGTH,
  MESSAGE_TYPE_IDS,
  PROTOCOL_VERSION,
  SERIALIZER_IDS,
} from "./constants.js";
import { decodePacketHeader, encodePacket, readPacketLength } from "./packet.js";

describe("packet", () => {
  it("encodes payload with rpc protocol header", () => {
    const payload = Buffer.from("hello", "utf8");
    const packet = encodePacket(payload, {
      serializer: "json",
      messageType: "request",
    });

    expect(packet.length).toBe(HEADER_LENGTH + payload.length);
    expect(packet.readUInt16BE(0)).toBe(MAGIC_NUMBER);
    expect(packet.readUInt8(2)).toBe(PROTOCOL_VERSION);
    expect(packet.readUInt8(3)).toBe(SERIALIZER_IDS.json);
    expect(packet.readUInt8(4)).toBe(MESSAGE_TYPE_IDS.request);
    expect(packet.readUInt8(5)).toBe(0);
    expect(packet.readUInt32BE(6)).toBe(payload.length);
    expect(packet.subarray(HEADER_LENGTH)).toEqual(payload);
  });

  it("decodes packet header", () => {
    const payload = Buffer.from("hello", "utf8");
    const packet = encodePacket(payload, {
      serializer: "protobuf",
      messageType: "response",
    });

    expect(decodePacketHeader(packet.subarray(0, HEADER_LENGTH))).toEqual({
      magic: MAGIC_NUMBER,
      version: PROTOCOL_VERSION,
      serializer: "protobuf",
      messageType: "response",
      flags: 0,
      bodyLength: payload.length,
    });
  });

  it("reads packet length from header", () => {
    const packet = encodePacket(Buffer.alloc(123), {
      serializer: "json",
      messageType: "ping",
    });

    expect(readPacketLength(packet.subarray(0, HEADER_LENGTH))).toBe(123);
  });

  it("throws when header is shorter than required length", () => {
    const header = Buffer.allocUnsafe(HEADER_LENGTH - 1);

    expect(() => readPacketLength(header)).toThrow(RangeError);
  });

  it("throws when magic number is invalid", () => {
    const packet = encodePacket(Buffer.from("hello"), {
      serializer: "json",
      messageType: "request",
    });
    packet.writeUInt16BE(0xbeef, 0);

    expect(() => decodePacketHeader(packet.subarray(0, HEADER_LENGTH))).toThrow(
      RangeError,
    );
  });

  it("throws when protocol version is unsupported", () => {
    const packet = encodePacket(Buffer.from("hello"), {
      serializer: "json",
      messageType: "request",
    });
    packet.writeUInt8(PROTOCOL_VERSION + 1, 2);

    expect(() => decodePacketHeader(packet.subarray(0, HEADER_LENGTH))).toThrow(
      RangeError,
    );
  });

  it("throws when packet length exceeds max packet length", () => {
    const header = Buffer.allocUnsafe(HEADER_LENGTH);
    header.writeUInt16BE(MAGIC_NUMBER, 0);
    header.writeUInt8(PROTOCOL_VERSION, 2);
    header.writeUInt8(SERIALIZER_IDS.json, 3);
    header.writeUInt8(MESSAGE_TYPE_IDS.request, 4);
    header.writeUInt8(0, 5);
    header.writeUInt32BE(MAX_PACKET_LENGTH + 1, 6);

    expect(() => readPacketLength(header)).toThrow(RangeError);
  });
});
