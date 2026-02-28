import { watch, type FSWatcher } from "fs";
import { resolve, basename } from "path";
import { broadcastEvent } from "./sse";

const IGNORE = new Set(["agent-state.json", "activity.jsonl", "server.port"]);
const DEBOUNCE_MS = 500;

let watcher: FSWatcher | null = null;

export function watchPlanningDir(cwd: string): void {
  const dir = resolve(cwd, ".planning");
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  try {
    watcher = watch(dir, { recursive: true }, (_event, filename) => {
      if (!filename) return;
      const base = basename(filename);
      if (IGNORE.has(base)) return;

      // Debounce per file
      const existing = timers.get(filename);
      if (existing) clearTimeout(existing);

      timers.set(
        filename,
        setTimeout(() => {
          timers.delete(filename);
          broadcastEvent("change", { reason: "file-watch", file: filename });
        }, DEBOUNCE_MS),
      );
    });

    watcher.on("error", (err) => {
      console.error("[watcher] error:", err.message);
    });
  } catch (err: any) {
    console.error("[watcher] failed to watch .planning:", err.message);
  }
}

export function stopWatcher(): void {
  watcher?.close();
  watcher = null;
}
