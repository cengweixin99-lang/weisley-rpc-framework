import { AgentResult, AgentService, AgentTask } from "@weisley-rpc/agent-contracts";

export class PlannerAgent implements AgentService {
    async execute(task: AgentTask): Promise<AgentResult> {
        const startedAt = new Date();
        const steps = [
            "Analyze the user requirement",
            "Draft an implementation plan",
            "Review risks and edge cases",
            "Summarize the final answer",
        ];
        const finishedAt = new Date();
        return {
            taskId: task.taskId,
            agentName: task.agentName,
            status: "success",
            output: {
                requirement: task.input,
                steps,
            },
            startedAt: startedAt.toISOString(),
            finishedAt: finishedAt.toISOString(),
            durationMs: finishedAt.getTime() - startedAt.getTime(),
        };
    }
}