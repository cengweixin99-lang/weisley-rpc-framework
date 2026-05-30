import { describe, expect, it } from "vitest";
import { HEADER_LENGTH, MAX_PACKET_LENGTH } from "./constants.js";
import { encodePacket, readPacketLength } from "./packet.js";

describe("packet", () => {
    it("encodes payload with a 4-byte length header", () => {
        const payload = Buffer.from("hello", "utf8");
        const packet = encodePacket(payload);

        expect(packet.length).toBe(HEADER_LENGTH + payload.length);
        expect(packet.readUint32BE(0)).toBe(payload.length);
        expect(packet.subarray(HEADER_LENGTH)).toEqual(payload);
    })

    it("reads packet length from header", () => {
        const header = Buffer.allocUnsafe(HEADER_LENGTH);
        header.writeUint32BE(123, 0);
        const length = readPacketLength(header);
        expect(length).toBe(123);
    })
    it("throws when header is shorter than required length", () => {
        const header = Buffer.allocUnsafe(HEADER_LENGTH - 1);

        expect(() => readPacketLength(header)).toThrow(RangeError);
    });
    it("throws when packet length is exceeds max packet length", () => {
        const header = Buffer.allocUnsafe(HEADER_LENGTH);
        header.writeUint32BE(MAX_PACKET_LENGTH + 1, 0);
        expect(() => readPacketLength(header)).toThrow(RangeError);
    });
});