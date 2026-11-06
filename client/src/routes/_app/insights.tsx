import { createFileRoute } from "@tanstack/react-router";
import { InsightsView } from "@/components/desk/insights-view";

export const Route = createFileRoute("/_app/insights")({
  head: () => ({ meta: [{ title: "Insights" }] }),
  component: InsightsPage,
});

function InsightsPage() {
  return <InsightsView />;
}
