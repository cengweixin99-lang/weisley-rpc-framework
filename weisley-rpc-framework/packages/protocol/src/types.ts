/**
 *  types.ts 定义 RPC 协议层最核心的数据结构，客户端和服务端在网络上传来传去的消息格式
 */

// 客户端发给服务端的请求消息
export type RpcRequest = {
  id: string; // 请求唯一 ID，用来匹配响应
  service: string; // 要调用哪个服务，比如 "UserService"
  method: string; // 要调用服务里的哪个方法，比如 "getUser"
  params: unknown[]; // 方法参数数组，比如 [1]
  meta?: Record<string, string>; // 可选元数据，比如 token、traceId、调用来源等
};

// 服务端返回给客户端的响应消息
export type RpcResponse = {
  id: string; // 对应的请求 id
  ok: boolean; //调用是否成功
  result?: unknown; //成功时的返回值
  error?: { // 失败时的错误信息
    code: string;
    message: string;
    stack?: string;
  };
};

// 联合类型，表示 RPC 网络消息可能是请求，也可能是响应
// 协议层不关心这条消息来自客户端还是服务端，只负责把 RpcMessage 编码成 Buffer，或者从 Buffer 解码出 RpcMessage
export type RpcMessage = RpcRequest | RpcResponse;

// 序列化器接口
export interface Serializer {
  serialize(message: RpcMessage): Buffer; // 把 RpcMessage 转为 Buffer
  deserialize(buffer: Buffer): RpcMessage; // 把 Buffer还原成 RpcMessage
}
