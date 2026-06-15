/**
 * Byte-oriented FIFO queue for TCP chunks.
 */
export class BufferQueue {
  private chunks: Buffer[] = [];
  private totalLength = 0;

  get length(): number {
    return this.totalLength;
  }

  push(chunk: Buffer): void {
    if (chunk.length === 0) {
      return;
    }

    this.chunks.push(chunk);
    this.totalLength += chunk.length;
  }

  peek(length: number): Buffer | null {
    if (length > this.totalLength) {
      return null;
    }

    return this.copy(length, false);
  }

  read(length: number): Buffer | null {
    if (length > this.totalLength) {
      return null;
    }

    return this.copy(length, true);
  }

  private copy(length: number, consume: boolean): Buffer {
    const output = Buffer.allocUnsafe(length);
    let offset = 0;
    let remaining = length;
    let chunkIndex = 0;

    while (remaining > 0) {
      const chunk = this.chunks[consume ? 0 : chunkIndex];
      if (!chunk) {
        break;
      }

      const bytesToCopy = Math.min(chunk.length, remaining);
      chunk.copy(output, offset, 0, bytesToCopy);

      offset += bytesToCopy;
      remaining -= bytesToCopy;

      if (consume) {
        if (bytesToCopy === chunk.length) {
          this.chunks.shift();
        } else {
          this.chunks[0] = chunk.subarray(bytesToCopy);
        }

        this.totalLength -= bytesToCopy;
      } else {
        chunkIndex += 1;
      }
    }

    return output;
  }
}
