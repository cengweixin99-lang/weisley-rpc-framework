import { RpcClient } from "@weisley-rpc/core";
import type { AgentResult, AgentTask } from "@weisley-rpc/agent-contracts";

export type RpcAgentClientOptions = {
  agentName: string;
  host: string;
  port: number;
  timeoutMs?: number;
};

export class RpcAgentClient {
    private readonly client: RpcClient;
    constructor(private readonly options: RpcAgentClientOptions) {
        this.client = new RpcClient({
            mode: "direct",
            host: options.host,
            port: options.port,
            timeoutMs: options.timeoutMs ?? 5000,
        });
    }

    async connect(): Promise<void> {
        await this.client.connect();
    }

    async execute(task: AgentTask): Promise<AgentResult> {
        const result = await this.client.call(
            this.options.agentName,
            "execute",
            [task],
        );
        return result as AgentResult;
    }

    close(): void {
        this.client.close();
    }
}