import { RpcServer } from "@weisley-rpc/core";
import type { AgentService } from "@weisley-rpc/agent-contracts";
export type StartAgentServerOptions = {
    agentName: string;
    implementation: AgentService;
    host?: string;
    port: number;
};
export type AgentServerHandle = {
    agentName: string;
    port: number;
    close(): Promise<void>;
}

export async function startAgentServer(
    options: StartAgentServerOptions
): Promise<AgentServerHandle> {
    const server = new RpcServer();
    server.registerService(options.agentName, {
        execute: options.implementation.execute.bind(options.implementation),
    });
    const listenOptions: { host?: string; port: number} = {
        port: options.port,
    }
    if (options.host !== undefined) {
        listenOptions.host = options.host;
    }
    await server.listen(listenOptions);

    const address = server.address();
    if (!address) {
        await server.close();
        throw new Error("Agent server address is not available");
    }
    return {
        agentName: options.agentName,
        port: address.port,
        async close() {
            await server.close();
        },
    };
}