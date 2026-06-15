import { RpcClient, RpcServer } from "@weisley-rpc/core";
import { JsonSerializer } from "@weisley-rpc/protocol";
import { createPayload, PAYLOAD_SIZES } from "../shared/payload.js";
import { runBenchmarkRounds } from "../shared/runner.js";
import type { BenchmarkCaseSummary, BenchmarkOptions } from "../shared/types.js";

const CONNECTION_POOL_SIZES = [1, 2, 4] as const;

export async function runConnectionPoolBenchmark(
  options: BenchmarkOptions,
  rounds: number,
): Promise<BenchmarkCaseSummary[]> {
  const results: BenchmarkCaseSummary[] = [];
  const payload = createPayload(PAYLOAD_SIZES.medium);

  for (const poolSize of CONNECTION_POOL_SIZES) {
    results.push(
      await runConnectionPoolCase(
        `connection-pool-${poolSize}`,
        poolSize,
        payload,
        options,
        rounds,
      ),
    );
  }

  return results;
}

async function runConnectionPoolCase(
  name: string,
  poolSize: number,
  payload: string,
  options: BenchmarkOptions,
  rounds: number,
): Promise<BenchmarkCaseSummary> {
  const serializer = new JsonSerializer();
  const server = new RpcServer();

  server.registerService("EchoService", {
    async echo(value: string) {
      return value;
    },
  });

  await server.listen({
    host: "127.0.0.1",
    port: 0,
    serializer,
  });

  const client = new RpcClient({
    mode: "direct",
    host: "127.0.0.1",
    port: getServerPort(server),
    timeoutMs: 5000,
    serializer,
    maxConnectionsPerEndpoint: poolSize,
  });

  await client.connect();

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
