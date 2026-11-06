import { Link, createFileRoute } from "@tanstack/react-router";
import { ChevronRight, ListOrdered, PlusCircle, Sparkles } from "lucide-react";
import { formatToken } from "@/lib/queue/format";
import { useDesk, useSampleShift } from "@/components/desk/desk-state";
import { CodeBadge, EmptyState, ListSkeleton, PageHeader } from "@/components/desk/ui";

export const Route = createFileRoute("/_app/queues/")({
  head: () => ({ meta: [{ title: "Queues · Queue Desk" }] }),
  component: QueuesPage,
});

function QueuesPage() {
  const { queues, ready } = useDesk();
  const sample = useSampleShift();

  return (
    <div className="rise space-y-6">
      <PageHeader
        eyebrow="All lines"
        title="Queues"
        description="Each queue keeps its own name, code and token sequence."
        actions={
          <Link to="/queues/new" className="btn btn-primary">
            <PlusCircle className="size-4" aria-hidden="true" />
            New queue
          </Link>
        }
      />
      {!ready ? (
        <ListSkeleton />
      ) : queues.length === 0 ? (
        <EmptyState icon={ListOrdered} title="No queues yet">
          <p>Create one to start issuing tokens, or load demo data to explore.</p>
          <button type="button" className="btn btn-line mt-4" disabled={sample.isPending} onClick={() => sample.mutate()}>
            <Sparkles className="size-4" aria-hidden="true" />
            {sample.isPending ? "Loading demo data…" : "Load demo data"}
          </button>
        </EmptyState>
      ) : (
        <ul className="space-y-3">
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
                        : "Nobody being served"}
                  </span>
                </span>
                <span className="chip tabular-nums">{queue.waiting} waiting</span>
                <ChevronRight className="size-5 text-slate-300" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {queues.length > 0 ? (
        <button type="button" className="btn btn-ghost px-3" disabled={sample.isPending} onClick={() => sample.mutate()}>
          <Sparkles className="size-4" aria-hidden="true" />
          {sample.isPending ? "Loading demo data…" : "Load demo data"}
        </button>
      ) : null}
    </div>
  );
}
