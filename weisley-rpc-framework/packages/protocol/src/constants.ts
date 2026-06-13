export const MAGIC_NUMBER = 0xcafe;
export const PROTOCOL_VERSION = 1;
export const HEADER_LENGTH = 10;
export const MAX_PACKET_LENGTH = 16 * 1024 * 1024;
export const PACKET_FLAG_COMPRESSED = 1 << 0;

export const SERIALIZER_IDS = {
  json: 1,
  protobuf: 2,
} as const;

export const MESSAGE_TYPE_IDS = {
  request: 1,
  response: 2,
  ping: 3,
  pong: 4,
} as const;
