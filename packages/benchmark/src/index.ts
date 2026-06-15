import { writeMarkdownReport } from "./shared/report.js";
import type { BenchmarkCaseSummary, BenchmarkOptions } from "./shared/types.js";
import { runJsonVsProtobufBenchmark } from "./rpc/json-vs-protobuf.bench.js";
import { runCompressionBenchmark } from "./rpc/compression.bench.js";
import { runConnectionPoolBenchmark } from "./rpc/connection-pool.bench.js";
import { runFailoverBenchmark } from "./rpc/failover.bench.js";

const options: BenchmarkOptions = {
  warmupRequests: 500,
  totalRequests: 5000,
  concurrency: 50,
};

const rounds = 3;
const summaries: BenchmarkCaseSummary[] = [];

summaries.push(...await runJsonVsProtobufBenchmark(options, rounds));
summaries.push(...await runCompressionBenchmark(options, rounds));
summaries.push(...await runConnectionPoolBenchmark(options, rounds));
summaries.push(
  ...await runFailoverBenchmark(
    {
      ...options,
      warmupRequests: 100,
      totalRequests: 300,
      concurrency: 1,
    },
    rounds,
  ),
);

await writeMarkdownReport(
    "reports/rpc-benchmark.md",
    summaries,
    options,
    rounds,
);

console.log("Benchmark report generated: reports/rpc-benchmark.md");
