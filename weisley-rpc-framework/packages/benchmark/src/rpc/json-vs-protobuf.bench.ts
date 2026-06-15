import { RpcClient, RpcServer } from "@weisley-rpc/core";
import { JsonSerializer, ProtobufSerializer } from "@weisley-rpc/protocol";
import { runBenchmarkRounds } from "../shared/runner.js";
import { createPayload, PAYLOAD_SIZES } from "../shared/payload.js";
import type { BenchmarkCaseSummary, BenchmarkOptions } from "../shared/types.js";

export async function runJsonVsProtobufBenchmark(
  options: BenchmarkOptions,
  rounds: number,
): Promise<BenchmarkCaseSummary[]> {
  const results: BenchmarkCaseSummary[] = [];

  for (const [sizeName, sizeBytes] of Object.entries(PAYLOAD_SIZES)) {
    results.push(
      await runSerializerCase(`json-${sizeName}`, new JsonSerializer(), sizeBytes, options, rounds),
    );

    results.push(
      await runSerializerCase(`protobuf-${sizeName}`, new ProtobufSerializer(), sizeBytes, options, rounds),
    );
  }

  return results;
}

async function runSerializerCase(
  name: string,
  serializer: JsonSerializer | ProtobufSerializer,
  payloadSize: number,
  options: BenchmarkOptions,
  rounds: number,
): Promise<BenchmarkCaseSummary> {
  const server = new RpcServer();

  server.registerService("EchoService", {
    async echo(payload: string) {
      return payload;
    },
  });

  await server.listen({
    host: "127.0.0.1",
    port: 0,
    serializer,
  });

  const port = getServerPort(server);

  const client = new RpcClient({
    mode: "direct",
    host: "127.0.0.1",
    port,
    timeoutMs: 5000,
    serializer,
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
