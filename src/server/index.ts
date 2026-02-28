import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/bun";
import { graphRoutes } from "./routes/graph";
import { agentRoutes } from "./routes/agents";
import { onboardRoutes } from "./routes/onboard";
import { sseRoute } from "./sse";
import { restoreAgents } from "../agents/runner";
import { watchPlanningDir, stopWatcher } from "./watcher";

const app = new Hono();

app.use("*", cors());

// API routes
app.route("/api", graphRoutes);
app.route("/api", agentRoutes);
app.route("/api", onboardRoutes);

// Restore agent state from previous run
const cwd = process.env.DCL_PROJECT_ROOT || process.cwd();
const interrupted = restoreAgents(cwd);
if (interrupted > 0) {
  console.error(`[declare] ${interrupted} agent(s) marked interrupted from previous run`);
}

// File watcher for external changes
watchPlanningDir(cwd);
process.on("exit", stopWatcher);
process.on("SIGINT", () => { stopWatcher(); process.exit(0); });
process.on("SIGTERM", () => { stopWatcher(); process.exit(0); });

// SSE
app.route("/", sseRoute);

// Static files (production — serve from dist/client)
app.use("/assets/*", serveStatic({ root: "./dist/client" }));
app.get("*", serveStatic({ root: "./dist/client", path: "index.html" }));

const port = parseInt(process.env.PORT || "3847", 10);

console.log(`Declare server listening on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
  idleTimeout: 255, // seconds — agent SDK calls can take minutes
};
