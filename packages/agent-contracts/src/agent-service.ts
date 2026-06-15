import type { AgentResult, AgentTask } from "./types.js";

export interface AgentService {
    execute(task: AgentTask): Promise<AgentResult>;
}