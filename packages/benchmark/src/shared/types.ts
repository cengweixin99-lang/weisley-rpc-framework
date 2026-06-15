export type BenchmarkOptions = {
    warmupRequests: number;
    totalRequests: number;
    concurrency: number;
};

export type LatencyStats = {
    avg: number;
    p50: number;
    p95: number;
    p99: number;
    max: number;
};

export type BenchmarkResult = {
    name: string;
    totalRequests: number;
    successRequests: number;
    failedRequests: number;
    durationMs: number;
    qps: number;
    latency: LatencyStats;
};

export type BenchmarkCaseSummary = {
    name: string;
    rounds: BenchmarkResult[];
    median: BenchmarkResult;
};

export type BenchmarkCase = {
    name: string;
    run(options: BenchmarkOptions): Promise<BenchmarkResult>;
}
