import { describe, expect, it } from "vitest";
import type { AgentService, AgentTask } from "@weisley-rpc/agent-contracts";
import { RpcAgentClient } from "./agent-client.js";
import { startAgentServer} from "./agent-server.js";

describe("agent runtime", () => {
    it("executes a task through rpc", async () => {
        const agent: AgentService = {
            async execute(task: AgentTask) {
                return {
                    taskId: task.taskId,
                    agentName: task.agentName,
                    status: "success",
                    output: {
                        message: `handled ${task.type}`
                    },
                    startedAt: new Date().toISOString(),
                    finishedAt: new Date().toISOString(),
                    durationMs: 0,
                };
            }
        };
        const server = await startAgentServer({
            agentName: "PlannerAgent",
            implementation: agent,
            host: "127.0.0.1",
            port: 0,
        });

        const client = new RpcAgentClient({
            agentName: "PlannerAgent",
            host: "127.0.0.1",
            port: server.port,
            timeoutMs: 1000,
        });

        await client.connect();

        try {
            const result = await client.execute({
                taskId: "task-1",
                agentName: "PlannerAgent",
                type: "plan",
                input: "build rpc agent demo",
                context: {
                    workflowId: "workflow-1",
                    traceId: "trace-1",
                },
            });
            expect(result.status).toBe("success");
            expect(result.output).toEqual({
                message: "handled plan",
            });
        } finally {
            client.close();
            await server.close();
        }
    });
});