import { RpcError } from "../errors.js";
import type { Endpoint, LoadBalancer } from "./types.js";

export class WeightedRoundRobinLoadBalancer implements LoadBalancer {

    private readonly cursors = new Map<string, number> ();
    select(serviceName: string, endpoints: Endpoint[]): Endpoint {
        // 1. 边界检查
        if (endpoints.length === 0) {
            throw new RpcError(
                `No endpoints available for service: ${serviceName}`,
                "NO_ENDPOINT_AVAILABLE",
            );
        }
        // 2. 展开加权端点列表
        const weightedEndpoints = this.expandWeightedEndpoints(endpoints);
        // 3. 获取当前游标位置
        const cursor = this.cursors.get(serviceName) ?? 0;
        // 4. 计算选中端点（循环取模）
        const endpoint = weightedEndpoints[cursor % weightedEndpoints.length]!;
        // 5. 游标后移一位
        this.cursors.set(serviceName, cursor + 1);
        return endpoint;
    }

    private expandWeightedEndpoints(endpoints: Endpoint[]): Endpoint[] {
        const weightedEndpoints: Endpoint[] = [];

        for (const endpoint of endpoints) {
            const weight = this.getWeight(endpoint);
            for (let i = 0; i < weight; i += 1) {
                weightedEndpoints.push(endpoint);
            }
        }
        return weightedEndpoints;
    }

    private getWeight(endpoint: Endpoint): number {
        const weight = endpoint.weight ?? 1;
        if (!Number.isFinite(weight)) {
            return 1;
        }
        return Math.max(1, Math.floor(weight));
    }
}