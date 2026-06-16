import type { NextFunction, Request, Response } from "express";

export function accessLogMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
): void {
    const startedAt = Date.now();

    res.on("finish", () => {
        const durationMs = Date.now() - startedAt;

        console.log(
            JSON.stringify({
                type: "http.access",
                requestId: req.requestId,
                userId: req.userContext?.userId,
                method: req.method,
                path: req.originalUrl,
                statusCode: res.statusCode,
                durationMs,
            }),
        );
    });
    next();
}