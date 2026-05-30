import { HEADER_LENGTH } from "./constants.js";
import { BufferQueue } from "./buffer-queue.js";
import { encodePacket, readPacketLength } from "./packet.js";
import { JsonSerializer } from "./serializer.js";
import type { RpcMessage, Serializer } from "./types.js";

export class RpcCodec {
  private readonly queue = new BufferQueue();

  constructor(private readonly serializer: Serializer = new JsonSerializer()) {}

  encode(message: RpcMessage): Buffer {
    return encodePacket(this.serializer.serialize(message));
  }

  push(chunk: Buffer): RpcMessage[] {
    this.queue.push(chunk);

    const messages: RpcMessage[] = [];

    while (this.queue.length >= HEADER_LENGTH) {
      const header = this.queue.peek(HEADER_LENGTH);
      if (!header) {
        break;
      }

      const bodyLength = readPacketLength(header);
      if (this.queue.length < HEADER_LENGTH + bodyLength) {
        break;
      }

      this.queue.read(HEADER_LENGTH);
      const body = this.queue.read(bodyLength);
      if (!body) {
        break;
      }

      messages.push(this.serializer.deserialize(body));
    }

    return messages;
  }
}
