import { Hono } from "hono";

type SSEWriter = (data: string) => void;
const clients = new Set<SSEWriter>();

/** Broadcast an SSE event to all connected clients */
export function broadcastEvent(event: string, data: unknown) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const write of clients) {
    try {
      write(payload);
    } catch {
      clients.delete(write);
    }
  }
}

export const sseRoute = new Hono();

sseRoute.get("/events", (c) => {
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const write: SSEWriter = (data: string) => {
        try { controller.enqueue(encoder.encode(data)); } catch {}
      };

      // Send initial retry directive
      write("retry: 3000\n\n");
      clients.add(write);

      // Keepalive ping every 30s
      const interval = setInterval(() => {
        try { write(": ping\n\n"); } catch { clearInterval(interval); }
      }, 30_000);

      // Cleanup when client disconnects — handled by AbortSignal
      c.req.raw.signal.addEventListener("abort", () => {
        clearInterval(interval);
        clients.delete(write);
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    },
  });
});
