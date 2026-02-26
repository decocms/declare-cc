import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { useGraph } from "../hooks/use-graph";

interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
});

function useTheme() {
  const [dark, setDark] = useState(() => {
    if (typeof window === "undefined") return false;
    return document.documentElement.classList.contains("dark");
  });

  const toggle = useCallback(() => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.theme = next ? "dark" : "light";
  }, [dark]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      if (!localStorage.theme) {
        setDark(e.matches);
        document.documentElement.classList.toggle("dark", e.matches);
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return { dark, toggle };
}

function RootLayout() {
  const { dark, toggle } = useTheme();
  const { data: graph } = useGraph();

  const d = graph?.stats?.declarations ?? 0;
  const m = graph?.stats?.milestones ?? 0;
  const a = graph?.stats?.actions ?? 0;
  const projectName = graph?.projectName ?? "Declare";

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-10 shrink-0 items-center justify-between border-b bg-card px-4">
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-semibold text-foreground">{projectName}</h1>
          <span className="text-[11px] text-muted-foreground">
            {d}D &middot; {m}M &middot; {a}A
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-muted-foreground hidden sm:block">
            <kbd className="font-mono">↑↓</kbd> nav
            <span className="mx-1">&middot;</span>
            <kbd className="font-mono">→</kbd> in
            <span className="mx-1">&middot;</span>
            <kbd className="font-mono">←</kbd> back
            <span className="mx-1">&middot;</span>
            <kbd className="font-mono">a</kbd> approve
            <span className="mx-1">&middot;</span>
            <kbd className="font-mono">p</kbd> plan
          </span>
          <button
            onClick={toggle}
            className="h-6 w-6 flex items-center justify-center text-xs rounded-md border bg-card hover:bg-accent transition-colors text-muted-foreground"
            title={dark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {dark ? "☀" : "☾"}
          </button>
        </div>
      </header>
      <main className="flex flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
