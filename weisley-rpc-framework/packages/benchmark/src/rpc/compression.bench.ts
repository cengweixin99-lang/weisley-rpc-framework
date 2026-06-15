import { GzipCompressor, JsonSerializer, RpcCodecCompressionOptions } from "@weisley-rpc/protocol";
import { createPayload, PAYLOAD_SIZES } from "../shared/payload.js";
import type { BenchmarkCaseSummary, BenchmarkOptions } from "../shared/types.js";
import { RpcClient, RpcServer } from "@weisley-rpc/core";
import { runBenchmarkRounds } from "../shared/runner.js";

export async function runCompressionBenchmark(
  options: BenchmarkOptions,
  rounds: number,
): Promise<BenchmarkCaseSummary[]> {
  const results: BenchmarkCaseSummary[] = [];
  for (const [sizeName, sizeBytes] of Object.entries(PAYLOAD_SIZES)) {
    results.push(
      await runCompressionCase(
        `json-${sizeName}-no-compression`,
        sizeBytes,
        options,
        rounds,
      ),
    );

    results.push(
      await runCompressionCase(
        `json-${sizeName}-gzip`,
        sizeBytes,
        options,
        rounds,
        {
          compressor: new GzipCompressor(),
          thresholdBytes: 1,
        },
      ),       
    );
  }
  return results;
}

async function runCompressionCase(
  name: string,
  payloadSize: number,
  options: BenchmarkOptions,
  rounds: number,
  compression?: RpcCodecCompressionOptions,
): Promise<BenchmarkCaseSummary> {
  const serializer = new JsonSerializer();
  const server = new RpcServer();

  server.registerService("EchoService", {
    async echo(payload: string) {
      return payload;
    },
  });

  const listenOptions = {
    host: "127.0.0.1",
    port: 0,
    serializer,
    ...(compression ? { compression } : {}),
  };

  await server.listen(listenOptions);

  const port = getServerPort(server);

  const client = new RpcClient({
    mode: "direct",
    host: "127.0.0.1",
    port,
    timeoutMs: 5000,
    serializer,
    ...(compression ? { compression }: {}),
  });
  await client.connect();

  const payload = createPayload(payloadSize);
  try {
    return await runBenchmarkRounds(name, options, rounds, async () => {
      await client.call("EchoService", "echo", [payload]);
    });
  } finally {
    client.close();
    await server.close();
  }
}

function getServerPort(server: RpcServer): number {
  const address = server.address();
  if (!address) {
    throw new Error("Server address is not available");
  }
  return address.port;
}
