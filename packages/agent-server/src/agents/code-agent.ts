import {
  AgentResult,
  AgentService,
  AgentTask,
} from "@weisley-rpc/agent-contracts";

export class CodeAgent implements AgentService {
  async execute(task: AgentTask): Promise<AgentResult> {
    const startedAt = new Date();

    const finishedAt = new Date();

    return {
      taskId: task.taskId,
      agentName: task.agentName,
      status: "success",
      output: {
        title: "Implementation Draft",
        summary: "Create a modular implementation based on the planner output.",
        files: [
          {
            path: "src/domain/order-service.ts",
            description: "Contains order creation and inventory deduction orchestration.",
          },
          {
            path: "src/domain/inventory-service.ts",
            description: "Contains stock checking and stock debuction logic.",
          },
          {
            path: "src/domain/payment-service.ts",
            description: "Contains payment reservation and confirmation logic.",
          },
        ],
      },
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
    };
  }
};

