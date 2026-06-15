import type {
  AgentResult,
  AgentService,
  AgentTask,
} from "@weisley-rpc/agent-contracts";

export class SummaryAgent implements AgentService {
  async execute(task: AgentTask): Promise<AgentResult> {
    const startedAt = new Date();

    const finishedAt = new Date();

    return {
      taskId: task.taskId,
      agentName: task.agentName,
      status: "success",
      output: {
        title: "Final Summary",
        answer:
          "The workflow completed successfully. The planner produced an execution plan, the code agent drafted an implementation structure, and the review agent identified key engineering risks.",
        nextActions: [
          "Confirm the domain model and API boundaries.",
          "Implement the core service logic.",
          "Add tests for concurrency, rollback, and idempotency.",
          "Expose metrics and tracing for production troubleshooting.",
        ],
      },
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
    };
  }
}