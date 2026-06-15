import type {
  AgentResult,
  AgentService,
  AgentTask,
} from "@weisley-rpc/agent-contracts";

export class ReviewAgent implements AgentService {
  async execute(task: AgentTask): Promise<AgentResult> {
    const startedAt = new Date();

    const finishedAt = new Date();

    return {
      taskId: task.taskId,
      agentName: task.agentName,
      status: "success",
      output: {
        title: "Review Result",
        risks: [
          {
            level: "medium",
            message: "Inventory deduction should be protected against concurrent updates.",
          },
          {
            level: "medium",
            message: "Order creation and payment confirmation should define clear rollback behavior.",
          },
          {
            level: "low",
            message: "The implementation should expose enough metrics for troubleshooting.",
          },
        ],
        suggestions: [
          "Use transaction boundaries around inventory deduction.",
          "Define idempotency keys for order creation and payment callbacks.",
          "Add structured logs and request tracing.",
        ],
      },
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
    };
  }
}