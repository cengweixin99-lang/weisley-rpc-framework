export type Endpoint = {
  host: string;
  port: number;
  weight?: number;
};

export interface Registry {
  lookup(serviceName: string): Endpoint[];
}

export interface LoadBalancer {
  select(serviceName: string, endpoints: Endpoint[]): Endpoint;
}
