import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { ErrorBoundary } from "../components/error-boundary";

export interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
});

function RootLayout() {
  return (
    <div className="flex h-screen flex-col">
      <ErrorBoundary>
        <Outlet />
      </ErrorBoundary>
    </div>
  );
}
