import { describe, expect, it } from "vitest";
import { JsonSerializer } from "./serializer.js";
import type { RpcRequest, RpcResponse } from "./types.js";

describe("JsonSerializer", () => {
    it("serializes and deserializers RpcRequest", () => {
        const serializer = new JsonSerializer();
        const request: RpcRequest = {
            type: "request",
            id: "req-1",
            service: "UserService",
            method: "getUser",
            params: [1],
            metadata: {
                traceId: "trace-1",
                source: "test",
            },
        };

        const buffer = serializer.serialize(request);
        const decoded = serializer.deserialize(buffer);

        expect(Buffer.isBuffer(buffer)).toBe(true);
        expect(decoded).toEqual(request);
    })

    it("serializes and deserializers RpcResponse", () => {
        const serializer = new JsonSerializer();
        const response: RpcResponse = {
            type: "response",
            id: "req-1",
            ok: true,
            result: {
                id: 1,
                name: "Alice",
            },
        };
        const buffer = serializer.serialize(response);
        const decoded = serializer.deserialize(buffer);
        expect(decoded).toEqual(response);
    });
});