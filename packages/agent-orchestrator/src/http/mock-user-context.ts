import type { NextFunction, Request, Response } from "express";

export type UserContext = {
    userId: string;
    workspaceId: string;
};

export function mockUserContextMiddleware(
    req: Request,
    _res: Response,
    next: NextFunction,
): void {
    req.userContext = {
        userId: req.header("x-user-id") ?? "demo-user",
        workspaceId: req.header("x-workspace-id") ?? "demo-workspace",
    };

    next();
}