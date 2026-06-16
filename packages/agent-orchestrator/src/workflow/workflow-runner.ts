import { randomUUID } from "node:crypto";
import { RpcAgentClient } from "@weisley-rpc/agent-runtime";
import type {
    AgentResult,
    AgentTask,
    WorkflowRequest,
    WorkflowResult,
    WorkflowStatus
} from "@weisley-rpc/agent-contracts";

const AGENT_ENDPOINTS = {
    PlannerAgent: {
        host: "127.0.0.1",
        port: 4201,
    },
    CodeAgent: {
        host: "127.0.0.1",
        port: 4202,
    },
    ReviewAgent: {
        host: "127.0.0.1",
        port: 4203,
    },
    SummaryAgent: {
        host: "127.0.0.1",
        port: 4204
    },
} as const;

export async function runWorkflow(
    request: WorkflowRequest,
): Promise<WorkflowResult> {
    const workflowId = randomUUID();
    const traceId = randomUUID();
    const startedAt = new Date();
    const steps: AgentResult[] = [];

    try {
        const plannerResult = await executeAgent({
            agentName: "PlannerAgent",
            taskType: "plan",
            input: request.input,
            workflowId,
            traceId,
        });
        steps.push(plannerResult);

        const codeAgentResult = await executeAgent({
            agentName: "CodeAgent",
            taskType: "code",
            input: plannerResult.output,
            workflowId,
            traceId,
            parentTaskId: plannerResult.taskId,
        });
        steps.push(codeAgentResult);

        const reviewResult = await executeAgent({
            agentName: "ReviewAgent",
            taskType: "review",
            input: codeAgentResult.output,
            workflowId,
            traceId,
            parentTaskId: codeAgentResult.taskId,
        });
        steps.push(reviewResult);

        const summaryResult = await executeAgent({
            agentName: "SummaryAgent",
            taskType: "summary",
            input: {
                planner: plannerResult.output,
                code: codeAgentResult.output,
                review: reviewResult.output,
            },
            workflowId,
            traceId,
            parentTaskId: reviewResult.taskId,
        });
        steps.push(summaryResult);
        
        return createWorkflowResult({
            workflowId,
            traceId,
            status: resolveWorkflowStatus(steps),
            output: summaryResult.output,
            startedAt,
            steps,
        });
    } catch(error) {
        return createWorkflowResult({
            workflowId,
            traceId,
            status: "failed",
            error: {
                code: getErrorCode(error),
                message: error instanceof Error ? error.message : String(error),
                retryable: false,
            },
            startedAt,
            steps,
        });
    }
}

async function executeAgent(options: {
    agentName: keyof typeof AGENT_ENDPOINTS;
    taskType: string;
    input: unknown;
    workflowId:string;
    traceId: string;
    parentTaskId?: string;
}): Promise<AgentResult> {
    const endpoint = AGENT_ENDPOINTS[options.agentName];
    const client = new RpcAgentClient({
        agentName: options.agentName,
        host: endpoint.host,
        port: endpoint.port,
        timeoutMs: 5000,
    });

    await client.connect();
    const context: AgentTask["context"] = {
        workflowId: options.workflowId,
        traceId: options.traceId,
    };

    if (options.parentTaskId !== undefined) {
        context.parentTaskId = options.parentTaskId;
    }

    const task: AgentTask = {
        taskId: randomUUID(),
        agentName: options.agentName,
        type: options.taskType,
        input: options.input,
        context,
    };

    try {
        return await client.execute(task);
    } finally {
        client.close();
    }
}

function createWorkflowResult(input: {
    workflowId: string;
    traceId: string;
    status: WorkflowStatus;
    output?: unknown,
    error?: {
        code: string;
        message: string;
        retryable?: boolean;
    };
    startedAt: Date;
    steps: AgentResult[];
}): WorkflowResult {
    const finishedAt = new Date();
    const result: WorkflowResult = {
        workflowId: input.workflowId,
        traceId: input.traceId,
        status: input.status,
        startedAt: input.startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs: finishedAt.getTime() - input.startedAt.getTime(),
        steps: input.steps,
    };
    if (input.output !== undefined) {
        result.output = input.output;
    }

    if (input.error !== undefined) {
        result.error = input.error;
    }
    return result;
}

function resolveWorkflowStatus(steps: AgentResult[]): WorkflowStatus {
    if (steps.some((step) => step.status === "failed")) {
        return "failed";
    }
    if (steps.some((step) => step.status === "degraded" || step.degraded)) {
        return "degraded";
    }
    return "success";
}

function getErrorCode(error: unknown): string {
    if (error && typeof error === "object" && "code" in error) {
        return String(error.code);
    }
    return "WORKFLOW_ERROR";
}