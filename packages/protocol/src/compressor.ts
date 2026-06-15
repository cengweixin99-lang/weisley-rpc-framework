import { gzipSync, gunzipSync } from "node:zlib";

export interface Compressor {
  readonly name: string;
  compress(payload: Buffer): Buffer;
  decompress(payload: Buffer): Buffer;
}

export class GzipCompressor implements Compressor {
  readonly name = "gzip";

  compress(payload: Buffer): Buffer {
    return gzipSync(payload);
  }

  decompress(payload: Buffer): Buffer {
    return gunzipSync(payload);
  }
}
