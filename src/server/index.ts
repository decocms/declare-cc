import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/bun";
import { graphRoutes } from "./routes/graph";
import { sseRoute } from "./sse";

const app = new Hono();

app.use("*", cors());

// API routes
app.route("/api", graphRoutes);

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
};
