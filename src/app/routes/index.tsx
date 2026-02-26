import { createFileRoute } from "@tanstack/react-router";
import { LifecycleView } from "../components/lifecycle-view";

export const Route = createFileRoute("/")({
  component: DashboardPage,
});

function DashboardPage() {
  return <LifecycleView />;
}
