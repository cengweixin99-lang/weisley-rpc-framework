import { performance } from "node:perf_hooks";
import { createBenchmarkResult, medianBy } from "./stats.js";
import type { BenchmarkCaseSummary, BenchmarkOptions, BenchmarkResult } from "./types.js";

export async function runBenchmark(
    name: string,
    options: BenchmarkOptions,
    task: () => Promise<unknown>,
): Promise<BenchmarkResult> {
    for (let i = 0; i < options.warmupRequests; i += 1) {
        await task();
    }
    const latencies: number[] = [];
    let successRequests = 0;
    let failedRequests = 0;
    let nextRequestIndex = 0;
    const startAt = performance.now();

    async function worker(): Promise<void> {
        while(true) {
            const requestIndex = nextRequestIndex;
            nextRequestIndex += 1;
            if (requestIndex >= options.totalRequests) {
                return;
            }
            const requestStartedAt = performance.now();

            try {
                await task();
                successRequests += 1;
            } catch {
                failedRequests += 1;
            } finally {
                latencies.push(performance.now() - requestStartedAt);
            }
        }
    }

    await Promise.all(
        Array.from({ length: options.concurrency }, () => worker()),
    );

    const durationMs = performance.now() - startAt;

    return createBenchmarkResult({
        name,
        totalRequests: options.totalRequests,
        successRequests,
        failedRequests,
        durationMs,
        latencies,
    });
}

export async function runBenchmarkRounds(
    name: string,
    options: BenchmarkOptions,
    rounds: number,
    task: () => Promise<unknown>,
): Promise<BenchmarkCaseSummary> {
    const results: BenchmarkResult[] = [];

    for (let round = 1; round <= rounds; round += 1) {
        console.log(`[bench] ${name} round ${round}/${rounds}`);
        results.push(await runBenchmark(`${name}#${round}`, options, task));
    }

    return {
        name,
        rounds: results,
        median: {
            ...medianBy(results, (result) => result.qps),
            name,
        },
    };
}
