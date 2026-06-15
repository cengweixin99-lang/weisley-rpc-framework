import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { arch, platform, release } from "node:os";
import type {
  BenchmarkCaseSummary,
  BenchmarkOptions,
  BenchmarkResult,
} from "./types.js";

export async function writeMarkdownReport(
  filePath: string,
  summaries: BenchmarkCaseSummary[],
  options: BenchmarkOptions,
  rounds: number,
): Promise<void> {
  const content = [
    "# RPC Benchmark Report",
    "",
    "## Environment",
    "",
    `- Node.js: ${process.version}`,
    `- Platform: ${platform()} ${release()} ${arch()}`,
    "",
    "## Config",
    "",
    `- Warmup Requests: ${options.warmupRequests}`,
    `- Total Requests: ${options.totalRequests}`,
    `- Concurrency: ${options.concurrency}`,
    `- Rounds: ${rounds}`,
    "- Payload Sizes:",
    "  - small: 100 bytes",
    "  - medium: 10 KB",
    "  - large: 100 KB",
    "",
    "## Median Results",
    "",
    "| case | qps | avg(ms) | p50(ms) | p95(ms) | p99(ms) | max(ms) | failed |",
    "|---|---:|---:|---:|---:|---:|---:|---:|",
    ...summaries.map((summary) => formatResultRow(summary.median)),
    "",
    "## Round Details",
    "",
    ...summaries.flatMap(formatRoundDetails),
    "",
    "## Notes",
    "",
    "- QPS is calculated from successful requests only.",
    "- Median results are selected by median QPS across rounds.",
    "- Latency is measured on the client side around each RPC call.",
    "- Each benchmark case starts its own server and client to avoid cross-case state pollution.",
    "- Round details are preserved to make benchmark variance visible.",
    "- The current Protobuf serializer uses a typed protobuf envelope while params/result are still JSON encoded, so it is not a pure schema-level Protobuf benchmark.",
    "",
    "## Observations",
    "",
    ...createObservations(summaries),
    "",
  ].join("\n");

  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf8");
}

function formatResultRow(result: BenchmarkResult): string {
  return `| ${result.name} | ${result.qps.toFixed(2)} | ${result.latency.avg.toFixed(2)} | ${result.latency.p50.toFixed(2)} | ${result.latency.p95.toFixed(2)} | ${result.latency.p99.toFixed(2)} | ${result.latency.max.toFixed(2)} | ${result.failedRequests} |`;
}

function formatRoundDetails(summary: BenchmarkCaseSummary): string[] {
  return [
    `### ${summary.name}`,
    "",
    "| round | qps | avg(ms) | p50(ms) | p95(ms) | p99(ms) | max(ms) | failed |",
    "|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...summary.rounds.map(
      (round, index) =>
        `| ${index + 1} | ${round.qps.toFixed(2)} | ${round.latency.avg.toFixed(2)} | ${round.latency.p50.toFixed(2)} | ${round.latency.p95.toFixed(2)} | ${round.latency.p99.toFixed(2)} | ${round.latency.max.toFixed(2)} | ${round.failedRequests} |`,
    ),
    "",
  ];
}

function createObservations(summaries: BenchmarkCaseSummary[]): string[] {
  const results = summaries.map((summary) => summary.median);
  const observations = [
    ...createSerializerObservations(results),
    ...createCompressionObservations(results),
    ...createConnectionPoolObservations(results),
    ...createFailoverObservations(results),
  ];

  if (observations.length === 0) {
    return ["- No automatic observations generated."];
  }

  return observations;
}

function createSerializerObservations(results: BenchmarkResult[]): string[] {
  const observations: string[] = [];
  const groups = [
    ["small", "json-small", "protobuf-small"],
    ["medium", "json-medium", "protobuf-medium"],
    ["large", "json-large", "protobuf-large"],
  ] as const;

  for (const [size, jsonName, protobufName] of groups) {
    const json = results.find((result) => result.name === jsonName);
    const protobuf = results.find((result) => result.name === protobufName);

    if (!json || !protobuf) {
      continue;
    }

    const faster =
      protobuf.qps >= json.qps
        ? `Protobuf is ${percentDiff(protobuf.qps, json.qps)} faster than JSON`
        : `JSON is ${percentDiff(json.qps, protobuf.qps)} faster than Protobuf`;

    observations.push(
      `- ${size} payload: ${faster} by median QPS. JSON p95=${json.latency.p95.toFixed(2)}ms, Protobuf p95=${protobuf.latency.p95.toFixed(2)}ms.`,
    );
  }

  return observations;
}

function createCompressionObservations(results: BenchmarkResult[]): string[] {
  const observations: string[] = [];
  const groups = [
    ["small","json-small-no-compression", "json-small-gzip"],
    ["medium", "json-medium-no-compression", "json-medium-gzip"],
    ["large", "json-large-no-compression", "json-large-gzip"],
  ] as const;
  for (const [size, plainName, gzipName] of groups) {
    const plain = results.find((result) => result.name === plainName);
    const gzip = results.find((result) => result.name === gzipName);
    if (!plain || !gzip) {
      continue;
    }
    const faster = 
      gzip.qps >= plain.qps
        ? `gzip is ${percentDiff(gzip.qps, plain.qps)} faster than no compression` 
        : `no compression is ${percentDiff(plain.qps, gzip.qps)} faster than gzip`;
    
    observations.push(
      `- ${size} payload compression: ${faster} by median QPS. no-compression p95=${plain.latency.p95.toFixed(2)}ms, gzip p95=${gzip.latency.p95.toFixed(2)}ms.`,
    );
  }
  return observations;
}

function createConnectionPoolObservations(results: BenchmarkResult[]): string[] {
  const pool1 = results.find((result) => result.name === "connection-pool-1");
  const pool2 = results.find((result) => result.name === "connection-pool-2");
  const pool4 = results.find((result) => result.name === "connection-pool-4");

  if (!pool1 || !pool2 || !pool4) {
    return [];
  }

  const best = [pool1, pool2, pool4].sort((a, b) => b.qps - a.qps)[0]!;

  return [
    `- connection pool: best median QPS is ${best.name} (${best.qps.toFixed(2)} QPS). pool-2 vs pool-1=${signedPercentDiff(pool2.qps, pool1.qps)}, pool-4 vs pool-1=${signedPercentDiff(pool4.qps, pool1.qps)}. p95 latency: pool-1=${pool1.latency.p95.toFixed(2)}ms, pool-2=${pool2.latency.p95.toFixed(2)}ms, pool-4=${pool4.latency.p95.toFixed(2)}ms.`,
  ];
}

function createFailoverObservations(results: BenchmarkResult[]): string[] {
  const healthy = results.find((result) => result.name === "discovery-healthy");
  const failover = results.find((result) => result.name === "discovery-failover");

  if (!healthy || !failover) {
    return [];
  }

  return [
    `- discovery failover: failover median QPS is ${signedPercentDiff(failover.qps, healthy.qps)} vs healthy discovery. healthy p95=${healthy.latency.p95.toFixed(2)}ms, failover p95=${failover.latency.p95.toFixed(2)}ms, failover failed=${failover.failedRequests}.`,
  ];
}

function percentDiff(base: number, compared: number): string {
  if (compared === 0) {
    return "0.00%";
  }

  return `${(((base - compared) / compared) * 100).toFixed(2)}%`;
}

function signedPercentDiff(base: number, compared: number): string {
  if (compared === 0) {
    return "0.00%";
  }

  const diff = ((base - compared) / compared) * 100;
  return `${diff >= 0 ? "+" : ""}${diff.toFixed(2)}%`;
}
