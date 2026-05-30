import { MethodNotFoundError, ServiceNotFoundError } from "../errors.js";
import type { ServiceImplementation } from "../types.js";

export class ServiceRegistry {
  private readonly services = new Map<string, ServiceImplementation>();

  register(serviceName: string, implementation: ServiceImplementation): void {
    this.services.set(serviceName, implementation);
  }

  getMethod(serviceName: string, methodName: string): (...args: unknown[]) => unknown | Promise<unknown> {
    const service = this.services.get(serviceName);
    if (!service) {
      throw new ServiceNotFoundError(serviceName);
    }

    const method = service[methodName];
    if (typeof method !== "function") {
      throw new MethodNotFoundError(serviceName, methodName);
    }

    return method.bind(service);
  }
}
