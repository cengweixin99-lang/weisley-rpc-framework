import type { ErrorRequestHandler } from "express";

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
    const message = error instanceof Error ? error.message : String(error);

    console.error(
        JSON.stringify({
            type: "http.error",
            requestId: req.requestId,
            userId: req.userContext?.userId,
            message,
        }),
    );

    res.status(500).json({
        error: {
            code: "INTERNAL_SERVER_ERROR",
            message,
            requestId: req.requestId,
        },
    });
};