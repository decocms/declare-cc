import { Hono } from "hono";
import { streamSSE } from "hono/streaming";

/** Active SSE clients */
const clients = new Set<ReadableStreamDefaultController>();

/** Broadcast an event to all SSE clients */
export function broadcast(event: string, data: unknown) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const controller of clients) {
    try {
      controller.enqueue(new TextEncoder().encode(payload));
    } catch {
      clients.delete(controller);
    }
  }
}

export const sseRoute = new Hono();

sseRoute.get("/events", (c) => {
  return streamSSE(c, async (stream) => {
    const controller = stream as unknown as ReadableStreamDefaultController;

    // For Hono streamSSE we use a different approach
    // Send retry directive
    await stream.writeSSE({ event: "connected", data: "ok", retry: 3000 });

    // Keep alive with periodic pings
    const interval = setInterval(async () => {
      try {
        await stream.writeSSE({ event: "ping", data: "" });
      } catch {
        clearInterval(interval);
      }
    }, 30_000);

    // Register for broadcasts
    const id = Symbol();
    const handler = (event: string, data: unknown) => {
      stream.writeSSE({ event, data: JSON.stringify(data) }).catch(() => {});
    };
    broadcastHandlers.set(id, handler);

    // Cleanup on close
    stream.onAbort(() => {
      clearInterval(interval);
      broadcastHandlers.delete(id);
    });

    // Block until aborted
    await new Promise(() => {});
  });
});

type BroadcastHandler = (event: string, data: unknown) => void;
const broadcastHandlers = new Map<symbol, BroadcastHandler>();

/** Enhanced broadcast that uses stream handlers */
export function broadcastEvent(event: string, data: unknown) {
  for (const handler of broadcastHandlers.values()) {
    handler(event, data);
  }
}
