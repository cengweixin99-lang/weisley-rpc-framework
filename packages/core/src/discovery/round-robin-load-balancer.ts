import { RpcError } from "../errors.js";
import type { Endpoint, LoadBalancer } from "./types.js";

export class RoundRobinLoadBalancer implements LoadBalancer {
    private readonly cursors = new Map<string, number>();
    select(serviceName: string, endpoints: Endpoint[]): Endpoint {
        if (endpoints.length === 0) {
            throw new RpcError(`No endpoints available for service: ${serviceName}`, "NO_ENDPOINT_AVAILABLE");
        }
        const cursor = this.cursors.get(serviceName) ?? 0;
        const endpoint = endpoints[(cursor % endpoints.length)]!;
        this.cursors.set(serviceName, cursor + 1);
        return endpoint;
    }
}