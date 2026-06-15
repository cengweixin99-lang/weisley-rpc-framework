import { RpcClient, RpcServer, RoundRobinLoadBalancer, StaticRegistry } from "@weisley-rpc/core";
import { JsonSerializer } from "@weisley-rpc/protocol";
import { createPayload, PAYLOAD_SIZES } from "../shared/payload.js";
import { runBenchmarkRounds } from "../shared/runner.js";
import type { BenchmarkCaseSummary, BenchmarkOptions } from "../shared/types.js";

export async function runFailoverBenchmark(
  options: BenchmarkOptions,
  rounds: number,
): Promise<BenchmarkCaseSummary[]> {
  const results: BenchmarkCaseSummary[] = [];
  const payload = createPayload(PAYLOAD_SIZES.medium);

  results.push(
    await runFailoverCase("discovery-healthy", payload, options, rounds, false),
  );

  results.push(
    await runFailoverCase("discovery-failover", payload, options, rounds, true),
  );

  return results;
}

async function runFailoverCase(
  name: string,
  payload: string,
  options: BenchmarkOptions,
  rounds: number,
  failover: boolean,
): Promise<BenchmarkCaseSummary> {
  const serializer = new JsonSerializer();
  const server1 = new RpcServer();
  const server2 = new RpcServer();

  registerEchoService(server1);
  registerEchoService(server2);

  await server1.listen({
    host: "127.0.0.1",
    port: 0,
    serializer,
  });

  await server2.listen({
    host: "127.0.0.1",
    port: 0,
    serializer,
  });

  const endpoint1 = {
    host: "127.0.0.1",
    port: getServerPort(server1),
  };
  const endpoint2 = {
    host: "127.0.0.1",
    port: getServerPort(server2),
  };

  const client = new RpcClient({
    mode: "discovery",
    registry: new StaticRegistry({
      EchoService: [endpoint1, endpoint2],
    }),
    loadBalancer: new RoundRobinLoadBalancer(),
    timeoutMs: 5000,
    serializer,
  });

  await client.connect();

  if (failover) {
    await server1.close();
  }

  try {
    const summary = await runBenchmarkRounds(name, options, rounds, async () => {
      await client.call("EchoService", "echo", [payload]);
    });

    if (summary.rounds.some((round) => round.failedRequests > 0)) {
      throw new Error(`Failover benchmark produced failed RPC calls for ${name}`);
    }

    return summary;
  } finally {
    client.close();
    await server1.close();
    await server2.close();
  }
}

function registerEchoService(server: RpcServer): void {
  server.registerService("EchoService", {
    async echo(value: string) {
      return value;
    },
  });
}

function getServerPort(server: RpcServer): number {
  const address = server.address();
  if (!address) {
    throw new Error("Server address is not available");
  }

  return address.port;
}
