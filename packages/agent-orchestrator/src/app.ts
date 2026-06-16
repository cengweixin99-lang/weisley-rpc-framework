import express from "express";
import { router } from "./router.js";
import { requestIdMiddleware } from "./http/request-id.js";
import { mockUserContextMiddleware } from "./http/mock-user-context.js";
import { accessLogMiddleware } from "./http/access-log.js";
import { errorHandler } from "./http/error-handler.js";

const app = express();
const port = Number(process.env.PORT ?? 4300);

app.use(express.json({ limit: "32kb" }));
app.use(requestIdMiddleware);
app.use(mockUserContextMiddleware);
app.use(accessLogMiddleware);
app.use(router);
app.use(errorHandler);

app.listen(port, () => {
    console.log(`Agent orchestrator listening on http://127.0.0.1:${port}`);
});