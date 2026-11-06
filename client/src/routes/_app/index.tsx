import { createFileRoute, redirect } from "@tanstack/react-router";
import { AuthCard } from "@/components/desk/auth-card";
import { AuthShell } from "@/components/desk/auth-shell";
import { DashboardView } from "@/components/desk/dashboard-view";
import { useOptionalDesk } from "@/components/desk/desk-state";

export const Route = createFileRoute("/_app/")({
  beforeLoad: ({ location }) => {
    const params = new URLSearchParams(location.searchStr);
    const queue = params.get("queue");
    if (params.get("view") === "insights") throw redirect({ to: "/insights", replace: true });
    if (queue) throw redirect({ to: "/queues/$queueId", params: { queueId: queue }, replace: true });
  },
  head: () => ({ meta: [{ title: "Dashboard · Queue Desk" }] }),
  component: Home,
});

function Home() {
  const desk = useOptionalDesk();
  if (!desk) {
    return (
      <AuthShell>
        <AuthCard />
      </AuthShell>
    );
  }
  return <DashboardView />;
}
