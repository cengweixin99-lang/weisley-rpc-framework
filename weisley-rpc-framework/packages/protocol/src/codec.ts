import {
  HEADER_LENGTH,
  MAX_PACKET_LENGTH,
  PACKET_FLAG_COMPRESSED,
} from "./constants.js";
import { BufferQueue } from "./buffer-queue.js";
import { decodePacketHeader, encodePacket } from "./packet.js";
import { JsonSerializer } from "./serializer.js";
import type { Compressor } from "./compressor.js";
import type { RpcMessage, Serializer, SerializerName } from "./types.js";

export type RpcCodecOptions = {
  serializer?: Serializer;
  serializers?: Serializer[];
  compression?: RpcCodecCompressionOptions;
  maxBodyLength?: number;
  maxDecompressedBodyLength?: number;
};

export type RpcCodecCompressionOptions = {
  compressor: Compressor;
  thresholdBytes: number;
};

export class RpcCodec {
  private readonly queue = new BufferQueue();
  private readonly defaultSerializer: Serializer;
  private readonly serializers = new Map<SerializerName, Serializer>();
  private readonly compression: RpcCodecCompressionOptions | undefined;
  private readonly maxBodyLength: number;
  private readonly maxDecompressedBodyLength: number;

  constructor(optionsOrSerializer: RpcCodecOptions | Serializer = {}) {
    const options = isSerializer(optionsOrSerializer)
      ? { serializer: optionsOrSerializer }
      : optionsOrSerializer;

    this.defaultSerializer = options.serializer ?? new JsonSerializer();
    this.compression = options.compression;
    this.maxBodyLength = normalizeLimit(
      options.maxBodyLength,
      MAX_PACKET_LENGTH,
    );
    this.maxDecompressedBodyLength = normalizeLimit(
      options.maxDecompressedBodyLength,
      this.maxBodyLength,
    );
    this.registerSerializer(this.defaultSerializer);

    for (const serializer of options.serializers ?? []) {
      this.registerSerializer(serializer);
    }
  }

  encode(message: RpcMessage): Buffer {
    const serialized = this.defaultSerializer.serialize(message);
    this.assertBodyLength(serialized.length, this.maxBodyLength, "Serialized");

    const shouldCompress =
      this.compression &&
      serialized.length >= this.compression.thresholdBytes;
      
    const payload = shouldCompress
      ? this.compression.compressor.compress(serialized)
      : serialized;

    return encodePacket(payload, {
      serializer: this.defaultSerializer.name,
      messageType: message.type,
      flags: shouldCompress ? PACKET_FLAG_COMPRESSED : 0,
    });
  }

  push(chunk: Buffer): RpcMessage[] {
    this.queue.push(chunk);

    const messages: RpcMessage[] = [];

    while (this.queue.length >= HEADER_LENGTH) {
      const header = this.queue.peek(HEADER_LENGTH);
      if (!header) {
        break;
      }

      const packetHeader = decodePacketHeader(header);
      if (this.queue.length < HEADER_LENGTH + packetHeader.bodyLength) {
        break;
      }

      this.queue.read(HEADER_LENGTH);
      const body = this.queue.read(packetHeader.bodyLength);
      if (!body) {
        break;
      }

      this.assertBodyLength(body.length, this.maxBodyLength, "Packet");

      const serializer = this.serializers.get(packetHeader.serializer);
      if (!serializer) {
        throw new RangeError(
          `Serializer is not registered: ${packetHeader.serializer}`,
        );
      }

      const payload =
        (packetHeader.flags & PACKET_FLAG_COMPRESSED) !== 0
          ? this.decompress(body)
          : body;
      this.assertBodyLength(
        payload.length,
        this.maxDecompressedBodyLength,
        "Decompressed",
      );

      const message = serializer.deserialize(payload);
      if (message.type !== packetHeader.messageType) {
        throw new RangeError(
          `Packet message type mismatch: header=${packetHeader.messageType}, body=${message.type}`,
        );
      }

      messages.push(message);
    }

    return messages;
  }

  private registerSerializer(serializer: Serializer): void {
    this.serializers.set(serializer.name, serializer);
  }

  private decompress(payload: Buffer): Buffer {
    if (!this.compression) {
      throw new RangeError("Compressed packet received but no compressor is configured");
    }

    return this.compression.compressor.decompress(payload);
  }

  private assertBodyLength(length: number, limit: number, label: string): void {
    if (length > limit) {
      throw new RangeError(`${label} body length ${length} exceeds limit ${limit}`);
    }
  }
}

function normalizeLimit(value: number | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }

  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError("Body length limit must be greater than 0");
  }

  return Math.floor(value);
}

function isSerializer(value: RpcCodecOptions | Serializer): value is Serializer {
  return (
    typeof value === "object" &&
    value !== null &&
    "serialize" in value &&
    "deserialize" in value &&
    "name" in value
  );
}
