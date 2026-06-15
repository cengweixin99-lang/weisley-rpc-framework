import { RpcError } from "../errors.js";
import type { Endpoint, LoadBalancer } from "./types.js";

export class LeastActiveLoadBalancer implements LoadBalancer {
    private readonly activeCounts = new Map<string, number>();
    select(serviceName: string, endpoints: Endpoint[]): Endpoint {
        if (endpoints.length === 0) {
            throw new RpcError(
                `No endpoints available for service: ${serviceName}`,
                "NO_ENDPOINT_AVAILABLE",
            );
        }
        let selected = endpoints[0]!;
        let selectedActiveCount = this.getActiveCount(selected);

        for (const endpoint of endpoints.slice(1)) {
            const activeCount = this.getActiveCount(endpoint);
            if (activeCount < selectedActiveCount) {
                selected = endpoint;
                selectedActiveCount = activeCount;
            }
        }
        return selected;
    }
   setActiveCount(endpoint: Endpoint, count: number): void {
        const normalizedCount = Number.isFinite(count)
            ? Math.max(0, Math.floor(count))
            : 0;
            
        this.activeCounts.set(this.getEndpointKey(endpoint), normalizedCount);
    }
    getActiveCount(endpoint: Endpoint): number {
        return this.activeCounts.get(this.getEndpointKey(endpoint)) ?? 0;
    }
    private getEndpointKey(endpoint: Endpoint): string {
        return `${endpoint.host}:${endpoint.port}`;
    }
}