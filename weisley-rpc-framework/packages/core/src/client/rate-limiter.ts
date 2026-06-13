export type RateLimiterOptions = {
    capacity: number; // 桶最大容量
    refillTokens: number; // 每次补充几个 token
    refillIntervalMs: number; // 多久补充一次
};

export class TokenBucketRateLimiter {
    private tokens: number;
    private lastRefillAt: number;
    private readonly options: RateLimiterOptions;
    constructor(options: RateLimiterOptions) {
        this.options = {
            capacity: Math.max(1, Math.floor(options.capacity)),
            refillTokens: Math.max(1, Math.floor(options.refillTokens)),
            refillIntervalMs: Math.max(1, Math.floor(options.refillIntervalMs)),
        };

        this.tokens = this.options.capacity;
        this.lastRefillAt = Date.now();
    }

    /**
     * 判断是否允许请求
     * @returns 
     */
    allow(): boolean {
        this.refill();
        if (this.tokens <= 0) {
            return false;
        }
        this.tokens -= 1;
        return true;
    }

    getAvailableTokens(): number {
        this.refill();
        return this.tokens;
    }

    private refill(): void {
        const now = Date.now();
        const elapsedMs = now - this.lastRefillAt;

        const intervals = Math.floor(elapsedMs / this.options.refillIntervalMs);

        if (intervals <= 0) {
            return;
        }

        this.tokens = Math.min(
            this.options.capacity,
            this.tokens + intervals * this.options.refillTokens,
        );
        this.lastRefillAt += intervals * this.options.refillIntervalMs;
    }
}