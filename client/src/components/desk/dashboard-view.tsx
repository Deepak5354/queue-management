import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, Clock, ListOrdered, PlusCircle, Sparkles, Users } from "lucide-react";
import { getInsights } from "@/lib/queue/api";
import { formatMinutes, formatToken } from "@/lib/queue/format";
import { useDesk, useSampleShift } from "@/components/desk/desk-state";
import { QueueForm } from "@/components/desk/queue-form";
import { CodeBadge, EmptyState, ListSkeleton, PageHeader, StatCard } from "@/components/desk/ui";

function greeting(name: string | null) {
  const hour = new Date().getHours();
  const hello = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const first = name?.split(" ")[0];
  return first ? `${hello}, ${first}` : hello;
}

export function DashboardView() {
  const { queues, ready, profile } = useDesk();
  const sample = useSampleShift();
  const [statsReady, setStatsReady] = useState(false);
  useEffect(() => {
    setStatsReady(true);
  }, []);
  const insights = useQuery({
    queryKey: ["insights", "today"],
    queryFn: () => getInsights({ data: { range: "today", tzOffsetMinutes: new Date().getTimezoneOffset() } }),
    staleTime: 20_000,
    enabled: statsReady,
  });
  const waiting = queues.reduce((sum, queue) => sum + queue.waiting, 0);
  const serving = queues.filter((queue) => queue.servingName).length;
  const data = insights.data;

  return (
    <div className="rise space-y-8">
      <PageHeader
        eyebrow="Overview"
        title={statsReady ? greeting(profile.displayName) : "Welcome"}
        description="Here is how your queues are doing right now."
        actions={
          <Link to="/queues/new" className="btn btn-primary">
            <PlusCircle className="size-4" aria-hidden="true" />
            New queue
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Queues" value={String(queues.length)} icon={ListOrdered} loading={!ready} />
        <StatCard label="Waiting now" value={String(waiting)} icon={Users} tone="warn" loading={!ready} />
        <StatCard label="In service" value={String(serving)} icon={Sparkles} tone="success" loading={!ready} />
        <StatCard
          label="Served today"
          value={data ? String(data.served) : "—"}
          hint={data ? `Avg wait ${formatMinutes(data.avgWaitSec)}` : undefined}
          icon={CheckCircle2}
          loading={!data && insights.isLoading}
        />
      </div>

      {data ? (
        <div className="panel flex flex-wrap items-center gap-x-8 gap-y-2 px-5 py-4 text-sm">
          <span className="flex items-center gap-2 text-muted">
            <Clock className="size-4 text-primary" aria-hidden="true" />
            Average wait <strong className="font-semibold text-ink">{formatMinutes(data.avgWaitSec)}</strong>
          </span>
          <span className="text-muted">
            Longest waiting now <strong className="font-semibold text-ink">{formatMinutes(data.longestWaitSec)}</strong>
          </span>
          <Link to="/insights" className="ml-auto inline-flex items-center gap-1 font-semibold text-primary hover:underline">
            Full insights <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      ) : insights.isError ? (
        <p className="text-sm text-muted">Queue totals are ready. Insights will catch up shortly.</p>
      ) : null}

      <section>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-xl font-bold">Your queues</h2>
          <Link to="/queues" className="text-sm font-semibold text-primary hover:underline">
            View all
          </Link>
        </div>
        {!ready ? (
          <div className="mt-4">
            <ListSkeleton rows={2} />
          </div>
        ) : queues.length === 0 ? (
          <div className="mt-4 grid gap-6 lg:grid-cols-2">
            <div className="panel p-6">
              <h3 className="text-lg font-bold">Open your first queue</h3>
              <p className="mt-1 text-sm text-muted">Name a counter and give it a short code, like A or P.</p>
              <QueueForm taken={queues.map((queue) => queue.code)} />
            </div>
            <EmptyState icon={Sparkles} title="Want to see it in action?">
              <p>Add two queues with a morning of realistic waits so the dashboard and charts have something to show.</p>
              <button
                type="button"
                className="btn btn-line mt-4"
                disabled={sample.isPending}
                onClick={() => sample.mutate()}
              >
                {sample.isPending ? "Loading demo data…" : "Load demo data"}
              </button>
            </EmptyState>
          </div>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {queues.map((queue) => (
              <li key={queue.id}>
                <Link to="/queues/$queueId" params={{ queueId: queue.id }} className="panel flex items-center gap-4 p-4">
                  <CodeBadge code={queue.code} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-lg font-bold leading-tight">{queue.name}</span>
                    <span className="mt-0.5 block truncate text-sm text-muted">
                      {queue.servingName && queue.servingNumber != null
                        ? `Serving ${formatToken(queue.code, queue.servingNumber)} · ${queue.servingName}`
                        : queue.waiting === 0
                          ? "Idle"
                          : "Ready to call the next person"}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block font-display text-2xl font-extrabold leading-none tabular-nums">
                      {queue.waiting}
                    </span>
                    <span className="text-xs text-muted">waiting</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
