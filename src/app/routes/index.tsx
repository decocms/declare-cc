import { createFileRoute } from "@tanstack/react-router";
import { LifecycleView } from "../components/lifecycle-view";
import { Sidebar } from "../components/sidebar";

export const Route = createFileRoute("/")({
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <>
      <Sidebar />
      <LifecycleView />
    </>
  );
}
