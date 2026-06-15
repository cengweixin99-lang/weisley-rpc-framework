export type AgentStatus = "success" | "failed" | "degraded";
export type AgentContext = {
    workflowId: string;
    traceId: string;
    userId?: string;
    parentTaskId?: string;
    metadata?: Record<string, string>;
};

export type AgentTask = {
    taskId: string;
    agentName: string;
    type: string;
    input: unknown;
    context: AgentContext;
};

export type AgentError = {
    code: string;
    message: string;
    retryable?: boolean;
};

export type AgentResult = {
    taskId: string;
    agentName: string;
    status: AgentStatus;
    output?: unknown;
    error?: AgentError;
    startedAt: string;
    finishedAt: string;
    durationMs: number;
    degraded?: boolean;
    degradedReason?: string;
};

export type WorkflowRequest = {
    input: string;
    userId?: string;
    metadata?: Record<string, string>;
};

export type WorkflowStatus = "running" | "success" | "failed" | "degraded";

export type WorkflowResult = {
    workflowId: string;
    traceId: string;
    status: WorkflowStatus;
    output?: unknown;
    error?: AgentError;
    startedAt: string;
    finishedAt: string;
    durationMs: number;
    steps: AgentResult[];
};

export type WorkflowEventType =
    | "workflow.started"
    | "agent.started"
    | "agent.completed"
    | "agent.failed"
    | "workflow.completed"
    | "workflow.failed";

export type WorkflowEvent = {
    id: string;
    workflowId: string;
    traceId: string;
    type: WorkflowEventType;
    timestamp: string;
    agentName?: string;
    taskId?: string;
    payload?: unknown;
};