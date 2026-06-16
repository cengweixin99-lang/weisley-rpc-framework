import express, { type Router } from "express";
import { runWorkflow } from "./workflow/workflow-runner.js";
import type { WorkflowRequest } from "@weisley-rpc/agent-contracts";
import { validateWorkflowRequestMiddleware } from "./http/validate-workflow-request.js";
export const router: Router = express.Router();

router.post(
  "/api/workflows",
  validateWorkflowRequestMiddleware,
  async (req, res) => {
    if (!req.workflowRequest) {
      res.status(500).json({
        error: {
          code: "WORKFLOW_REQUEST_NOT_FOUND",
          message: "workflow request is not available",
          requestId: req.requestId,
        },
      });
      return;
    }

    const result = await runWorkflow(req.workflowRequest);

    res.status(result.status === "failed" ? 500 : 200).json(result);
  },
);
