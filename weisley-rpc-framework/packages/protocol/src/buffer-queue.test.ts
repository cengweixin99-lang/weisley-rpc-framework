/**
 *  1. 初始 length 是 0
    2. push 一个 chunk 后 length 增加
    3. read 可以读取并消费指定字节
    4. peek 可以读取但不消费字节
    5. read 长度不够时返回 null
    6. peek 长度不够时返回 null
    7. read 可以跨多个 chunk 读取
    8. peek 可以跨多个 chunk 读取且不消费
 */
import { describe, expect, it } from "vitest";
import { BufferQueue } from "./buffer-queue.js";

describe("BufferQueue", () => {
  it("starts with zero length", () => {
    const queue = new BufferQueue();

    expect(queue.length).toBe(0);
  });

  it("increases length after pushing chunk", () => {
    const queue = new BufferQueue();

    queue.push(Buffer.from("hello"));

    expect(queue.length).toBe(5);
  });

  it("reads and consumes bytes", () => {
    const queue = new BufferQueue();

    queue.push(Buffer.from("hello"));

    expect(queue.read(2)?.toString()).toBe("he");
    expect(queue.length).toBe(3);
    expect(queue.read(3)?.toString()).toBe("llo");
    expect(queue.length).toBe(0);
  });

  it("peeks without consuming bytes", () => {
    const queue = new BufferQueue();

    queue.push(Buffer.from("hello"));

    expect(queue.peek(2)?.toString()).toBe("he");
    expect(queue.length).toBe(5);
  });

  it("returns null when reading more bytes than available", () => {
    const queue = new BufferQueue();

    queue.push(Buffer.from("hi"));

    expect(queue.read(3)).toBeNull();
    expect(queue.length).toBe(2);
  });

  it("returns null when peeking more bytes than available", () => {
    const queue = new BufferQueue();

    queue.push(Buffer.from("hi"));

    expect(queue.peek(3)).toBeNull();
    expect(queue.length).toBe(2);
  });

  it("reads across multiple chunks", () => {
    const queue = new BufferQueue();

    queue.push(Buffer.from("he"));
    queue.push(Buffer.from("llo"));

    expect(queue.read(5)?.toString()).toBe("hello");
    expect(queue.length).toBe(0);
  });

  it("peeks across multiple chunks without consuming", () => {
    const queue = new BufferQueue();

    queue.push(Buffer.from("he"));
    queue.push(Buffer.from("llo"));

    expect(queue.peek(5)?.toString()).toBe("hello");
    expect(queue.length).toBe(5);
    expect(queue.read(5)?.toString()).toBe("hello");
  });
});
