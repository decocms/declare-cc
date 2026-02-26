import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import type { QueryClient } from "@tanstack/react-query";

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

  // Listen for system changes when no explicit preference
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

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-12 shrink-0 items-center justify-between border-b bg-card px-5">
        <h1 className="text-sm font-semibold text-foreground">Declare</h1>
        <button
          onClick={toggle}
          className="h-7 px-2 text-xs rounded-md border bg-card hover:bg-accent transition-colors text-muted-foreground"
          title={dark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {dark ? "☀︎ Light" : "☾ Dark"}
        </button>
      </header>
      <main className="flex flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
