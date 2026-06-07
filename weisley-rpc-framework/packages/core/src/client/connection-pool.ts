import { RpcConnection } from "./connection.js";
import type { ConnectionState } from "../types.js";

type RpcConnectionPoolOptions = {
    host: string;
    port: number;
    maxConnections: number;
    connectionOptions: {
        timeoutMs: number;
        heartbeatIntervalMs?: number | undefined;
        heartbeatTimeoutMs?: number | undefined;
        reconnect?: boolean | undefined;
        reconnectInitialDelayMs?: number | undefined;
        reconnectMaxDelayMs?: number | undefined;
    };
};

export class RpcConnectionPool {
    private readonly connections: RpcConnection[] = [];
    private nextIndex = 0;
    constructor(private readonly options: RpcConnectionPoolOptions){
        if (options.maxConnections <= 0) {
            throw new RangeError("maxConnections must be greater than 0");
        }
    }

    getConnection(): RpcConnection {
        if (this.connections.length < this.options.maxConnections) {
            const connection = this.createConnection();
            this.connections.push(connection);
            return connection;
        }

        const connection = this.connections[this.nextIndex];

        if (!connection) {
            throw new Error("Connection pool has no available connection");
        }
        this.nextIndex = (this.nextIndex + 1) % this.connections.length;
        return connection;
    }

    close(): void {
        for (const connection of this.connections) {
            connection.close();
        }
    }
    getState(): ConnectionState {
        const connection = this.connections[0];
        return connection?.getState() ?? "idle";
    }
    
    private createConnection(): RpcConnection {
        return new RpcConnection({
            host: this.options.host,
            port: this.options.port,
            ...this.options.connectionOptions,
        });
    }


}