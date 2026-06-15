import {
  HEADER_LENGTH,
  MAGIC_NUMBER,
  MAX_PACKET_LENGTH,
  MESSAGE_TYPE_IDS,
  PROTOCOL_VERSION,
  SERIALIZER_IDS,
} from "./constants.js";
import type { RpcMessage, SerializerName } from "./types.js";

export type PacketHeader = {
  magic: number;
  version: number;
  serializer: SerializerName;
  messageType: RpcMessage["type"];
  flags: number;
  bodyLength: number;
};

export type EncodePacketOptions = {
  serializer: SerializerName;
  messageType: RpcMessage["type"];
  flags?: number;
};

export function encodePacket(
  payload: Buffer,
  options: EncodePacketOptions,
): Buffer {
  if (payload.length > MAX_PACKET_LENGTH) {
    throw new RangeError(
      `Packet length ${payload.length} exceeds limit ${MAX_PACKET_LENGTH}`,
    );
  }

  const header = Buffer.allocUnsafe(HEADER_LENGTH);
  header.writeUInt16BE(MAGIC_NUMBER, 0);
  header.writeUInt8(PROTOCOL_VERSION, 2);
  header.writeUInt8(getSerializerId(options.serializer), 3);
  header.writeUInt8(getMessageTypeId(options.messageType), 4);
  header.writeUInt8(options.flags ?? 0, 5);
  header.writeUInt32BE(payload.length, 6);

  return Buffer.concat([header, payload]);
}

export function decodePacketHeader(header: Buffer): PacketHeader {
  if (header.length < HEADER_LENGTH) {
    throw new RangeError(`Packet header requires ${HEADER_LENGTH} bytes`);
  }

  const magic = header.readUInt16BE(0);
  if (magic !== MAGIC_NUMBER) {
    throw new RangeError(`Invalid magic number: ${magic}`);
  }

  const version = header.readUInt8(2);
  if (version !== PROTOCOL_VERSION) {
    throw new RangeError(`Unsupported protocol version: ${version}`);
  }

  const serializer = getSerializerName(header.readUInt8(3));
  const messageType = getMessageType(header.readUInt8(4));
  const flags = header.readUInt8(5);
  const bodyLength = header.readUInt32BE(6);

  if (bodyLength > MAX_PACKET_LENGTH) {
    throw new RangeError(
      `Packet length ${bodyLength} exceeds limit ${MAX_PACKET_LENGTH}`,
    );
  }

  return {
    magic,
    version,
    serializer,
    messageType,
    flags,
    bodyLength,
  };
}

export function readPacketLength(header: Buffer): number {
  return decodePacketHeader(header).bodyLength;
}

function getSerializerId(serializer: SerializerName): number {
  return SERIALIZER_IDS[serializer];
}

function getSerializerName(id: number): SerializerName {
  if (id === SERIALIZER_IDS.json) {
    return "json";
  }

  if (id === SERIALIZER_IDS.protobuf) {
    return "protobuf";
  }

  throw new RangeError(`Unsupported serializer id: ${id}`);
}

function getMessageTypeId(messageType: RpcMessage["type"]): number {
  return MESSAGE_TYPE_IDS[messageType];
}

function getMessageType(id: number): RpcMessage["type"] {
  if (id === MESSAGE_TYPE_IDS.request) {
    return "request";
  }

  if (id === MESSAGE_TYPE_IDS.response) {
    return "response";
  }

  if (id === MESSAGE_TYPE_IDS.ping) {
    return "ping";
  }

  if (id === MESSAGE_TYPE_IDS.pong) {
    return "pong";
  }

  throw new RangeError(`Unsupported message type id: ${id}`);
}
