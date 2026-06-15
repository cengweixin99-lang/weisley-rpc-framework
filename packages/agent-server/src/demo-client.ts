import { randomUUID } from "node:crypto";
import { RpcAgentClient } from "@weisley-rpc/agent-runtime";
import type { AgentTask } from "@weisley-rpc/agent-contracts";

const workflowId = randomUUID();
const traceId = randomUUID();

const planner = new RpcAgentClient({
    agentName: "PlannerAgent",
    host: "127.0.0.1",
    port: 4201,
    timeoutMs: 3000,
});

await planner.connect();
try {
    const task: AgentTask = {
        taskId: randomUUID(),
        agentName: "PlannerAgent",
        type: "plan",
        input: "Design an inventory deduction workflow for an order system.",
        context: {
            workflowId,
            traceId,
        },
    };
    const result = await planner.execute(task);
    console.log(JSON.stringify(result, null, 2));
} finally {
    planner.close();
}