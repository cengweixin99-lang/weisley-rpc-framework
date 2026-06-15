import type { BenchmarkResult, LatencyStats } from "./types.js";


export function percentile(values: number[], p: number): number {
    if (values.length === 0) {
        return 0;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)] ?? 0;
}

export function calculateLatencyStats(latencies: number[]): LatencyStats {
    if (latencies.length === 0) {
        return {
            avg: 0,
            p50: 0,
            p95: 0,
            p99: 0,
            max: 0
        };
    }
    const total = latencies.reduce((sum, value) => sum + value, 0);

    return {
        avg: total / latencies.length,
        p50: percentile(latencies, 50),
        p95: percentile(latencies, 95),
        p99: percentile(latencies, 99),
        max: Math.max(...latencies),
    };
}

export function createBenchmarkResult(input: {
    name: string;
    totalRequests: number;
    successRequests: number;
    failedRequests: number;
    durationMs: number;
    latencies: number[];
}): BenchmarkResult {
    return {
        name: input.name,
        totalRequests: input.totalRequests,
        successRequests: input.successRequests,
        failedRequests: input.failedRequests,
        durationMs: input.durationMs,
        qps: input.successRequests / (input.durationMs / 1000),
        latency: calculateLatencyStats(input.latencies),
    }
}

export function medianBy<T>(values: T[], selector: (value: T) => number): T {
    if (values.length === 0) {
        throw new Error("Cannot calculate median for empty values");
    }

    const sorted = [...values].sort((a, b) => selector(a) - selector(b));
    return sorted[Math.floor(sorted.length / 2)]!;
}
