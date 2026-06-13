export type CircuitBreakerState = "closed" | "open" | "half-open";

export type CircuitBreakerOptions = {
    failureThreshold: number; // 连续失败多少次后熔断
    resetTimeoutMs: number; // 熔断打开后，多久允许一次半开探测
};
// 熔断器状态记录
type CircuitBreakerEntry = {
    state: CircuitBreakerState;
    failureCount: number;
    openedAt?: number | undefined;
}

export class CircuitBreaker {
    private readonly entries = new Map<string, CircuitBreakerEntry>();
    private readonly options: CircuitBreakerOptions;
    constructor(options: CircuitBreakerOptions) {
        this.options = {
            failureThreshold: Math.max(1, Math.floor(options.failureThreshold)),
            resetTimeoutMs: Math.max(0, Math.floor(options.resetTimeoutMs)),
        };
    }
    /**
     * 调用前判断
     * @param key 
     */
    canRequest(key: string): boolean {
        const entry = this.getOrCreateEntry(key);
    
        if (entry.state === "closed") {
            return true;
        }
        if (entry.state === "half-open") {
            return true;
        }
        // 如果还没到 resetTimeoutMs 拒绝请求，如果到了切 half-open 允许
        const openedAt = entry.openedAt ?? 0;
        const elapsedMs = Date.now() - openedAt;
        if (elapsedMs >= this.options.resetTimeoutMs) {
            entry.state = "half-open";
            return true;
        }
        return false;
    }

    /**
     * 成功后关闭熔断器
     * @param key 
     */
    recordSuccess(key: string): void {
        const entry = this.getOrCreateEntry(key);
        this.close(entry);
    }

    /**
     * 失败逻辑
     * @param key 
     */
    recordFailure(key: string): void {
        const entry = this.getOrCreateEntry(key);
        if (entry.state === "half-open") {
            this.open(entry);
            return;
        }
        if (entry.state === "open") {
            return;
        }
        entry.failureCount += 1;
        if (entry.failureCount >= this.options.failureThreshold) {
            this.open(entry);
        }
    }

    getState(key: string): CircuitBreakerState {
        return this.getOrCreateEntry(key).state;
    }

    /**
     * 创建服务的熔断状态
     * @param key 
     */
    private getOrCreateEntry(key: string): CircuitBreakerEntry {
        let entry = this.entries.get(key);
        // 如果一个方法第一次出现，默认是 closed
        if (!entry) {
            entry = {
                state: "closed",
                failureCount: 0,
            };
        }
        this.entries.set(key, entry);
        return entry;
    }

    /**
     * 关闭熔断器逻辑
     */
    private close(entry: CircuitBreakerEntry): void{
        // 无论之前是 open 还是 half-open，只要成功就回到 closed
        entry.state = "closed";
        entry.failureCount = 0;
        entry.openedAt = undefined;
    }
    /**
     * 打开熔断器逻辑
     * @param entry 
     */
    private open(entry: CircuitBreakerEntry): void{
        entry.state = "open";
        entry.openedAt = Date.now();
    }
}