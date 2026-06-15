import { RpcError } from "../errors.js";
import type { Endpoint, LoadBalancer } from "./types.js";


export class RandomLoadBalancer implements LoadBalancer {
  select(serviceName: string, endpoints: Endpoint[]): Endpoint {
    if (endpoints.length === 0) {
      throw new RpcError(
        `No endpoints available for service: ${serviceName}`,
        "NO_ENDPOINT_AVAILABLE",
      );
    }

    const index = Math.floor(Math.random() * endpoints.length);
    return endpoints[index]!;
  }
}
