import { HEADER_LENGTH, MAX_PACKET_LENGTH } from "./constants.js";

export function encodePacket(payload: Buffer): Buffer {
  if (payload.length > MAX_PACKET_LENGTH) {
    throw new RangeError(`Packet length ${payload.length} exceeds limit ${MAX_PACKET_LENGTH}`);
  }

  const header = Buffer.allocUnsafe(HEADER_LENGTH);
  header.writeUInt32BE(payload.length, 0);

  return Buffer.concat([header, payload]);
}

export function readPacketLength(header: Buffer): number {
  if (header.length < HEADER_LENGTH) {
    throw new RangeError(`Packet header requires ${HEADER_LENGTH} bytes`);
  }

  const length = header.readUInt32BE(0);
  if (length > MAX_PACKET_LENGTH) {
    throw new RangeError(`Packet length ${length} exceeds limit ${MAX_PACKET_LENGTH}`);
  }

  return length;
}
