import type { NextFunction, Request, Response } from "express";
import type { WorkflowRequest } from "@weisley-rpc/agent-contracts";

const MAX_INPUT_LENGTH = 4000;

export function validateWorkflowRequestMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const body = req.body as unknown;

  if (!isRecord(body)) {
    res.status(400).json({
      error: {
        code: "INVALID_REQUEST",
        message: "request body must be an object",
        requestId: req.requestId,
      },
    });
    return;
  }

  const input = body["input"];

  if (typeof input !== "string" || input.trim().length === 0) {
    res.status(400).json({
      error: {
        code: "INVALID_REQUEST",
        message: "input is required",
        requestId: req.requestId,
      },
    });
    return;
  }

  if (input.length > MAX_INPUT_LENGTH) {
    res.status(400).json({
      error: {
        code: "INVALID_REQUEST",
        message: `input must be less than or equal to ${MAX_INPUT_LENGTH} characters`,
        requestId: req.requestId,
      },
    });
    return;
  }

  const request: WorkflowRequest = {
    input: input.trim(),
  };

  if (req.userContext?.userId !== undefined) {
    request.userId = req.userContext.userId;
  }

  const metadata = body["metadata"];
  if (metadata !== undefined) {
    if (!isStringRecord(metadata)) {
      res.status(400).json({
        error: {
          code: "INVALID_REQUEST",
          message: "metadata must be a string record",
          requestId: req.requestId,
        },
      });
      return;
    }

    request.metadata = metadata;
  }

  req.workflowRequest = request;
  next();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (!isRecord(value)) {
    return false;
  }

  return Object.values(value).every((item) => typeof item === "string");
}