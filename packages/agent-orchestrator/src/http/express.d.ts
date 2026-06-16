import type { UserContext } from "./mock-user-context.js";
import type { WorkflowRequest } from "@weisley-rpc/agent-contracts";

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      userContext?: UserContext;
      workflowRequest?: WorkflowRequest;
    }
  }
}