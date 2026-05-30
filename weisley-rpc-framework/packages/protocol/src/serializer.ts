import type { RpcMessage, Serializer } from "./types.js";

/**
 * 解决 RpcMessage <-> body Buffer
 */
export class JsonSerializer implements Serializer {
  // 序列化，RpcMessage -> Buffer
  serialize(message: RpcMessage): Buffer {
    //  Convert an RPC message object into a UTF-8 JSON Buffer.
    const json = JSON.stringify(message);
    return Buffer.from(json, "utf8");
  }

  // 反序列化，Buffer -> RpcMessage
  deserialize(buffer: Buffer): RpcMessage {
    // Convert a UTF-8 JSON Buffer back into an RPC message object.
    const json = buffer.toString("utf8");
    return JSON.parse(json) as RpcMessage;
  }
}
