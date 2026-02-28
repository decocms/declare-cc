import { createFileRoute } from "@tanstack/react-router";
import { ErrorBoundary } from "../components/error-boundary";
import { LifecycleView } from "../components/lifecycle-view";

export const Route = createFileRoute("/")({
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <ErrorBoundary>
      <LifecycleView />
    </ErrorBoundary>
  );
}
