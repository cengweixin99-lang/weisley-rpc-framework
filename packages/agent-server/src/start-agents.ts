import { startAgentServer } from "../../agent-runtime/dist/agent-server.js";
import { CodeAgent } from "./agents/code-agent.js";
import { PlannerAgent } from "./agents/planner-agent.js";
import { ReviewAgent } from "./agents/review-agent.js";
import { SummaryAgent } from "./agents/summary-agent.js";

const handles = await Promise.all([
    startAgentServer({
        agentName: "PlannerAgent",
        implementation: new PlannerAgent(),
        host: "127.0.0.1",
        port: 4201,
    }),
    startAgentServer({
        agentName: "CodeAgent",
        implementation: new CodeAgent(),
        host: "127.0.0.1",
        port: 4202,
    }),
    startAgentServer({
        agentName: "ReviewAgent",
        implementation: new ReviewAgent(),
        host: "127.0.0.1",
        port: 4203,
    }),
    startAgentServer({
        agentName: "SummaryAgent",
        implementation: new SummaryAgent(),
        host: "127.0.0.1",
        port: 4204,
    }),
]);

for (const handle of handles) {
    console.log(`${handle.agentName} listening on 127.0.0.1:${handle.port}`);
}

async function shutdown() {
    console.log("Shutting down agent servers...");
    await Promise.all(handles.map((handle) => handle.close()));
    console.log("Agent servers stopped.");
}

process.on("SIGINT", () => {
    void shutdown().then(() => {
        process.exit(0);
    });
});

process.on("SIGTERM", () => {
    void shutdown().then(() => {
        process.exit(0);
    });
});