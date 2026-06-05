import type { Endpoint, Registry } from "./types.js";

export class StaticRegistry implements Registry {
    constructor(private readonly services: Record<string, Endpoint[]>) {}

    lookup(serviceName: string): Endpoint[] {
        return this.services[serviceName] ?? [];
    }
}