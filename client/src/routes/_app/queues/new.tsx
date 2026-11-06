import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { QueueForm } from "@/components/desk/queue-form";
import { useDesk } from "@/components/desk/desk-state";
import { PageHeader } from "@/components/desk/ui";

export const Route = createFileRoute("/_app/queues/new")({
  head: () => ({ meta: [{ title: "New queue · Queue Desk" }] }),
  component: CreateQueuePage,
});

function CreateQueuePage() {
  const { queues } = useDesk();
  return (
    <div className="rise mx-auto max-w-xl space-y-6">
      <Link to="/queues" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to queues
      </Link>
      <PageHeader
        eyebrow="New line"
        title="Create a queue"
        description="A queue is a named counter. People get tokens, you call the next one, and every wait is recorded."
      />
      <div className="panel p-5 sm:p-6">
        <QueueForm taken={queues.map((queue) => queue.code)} />
      </div>
    </div>
  );
}
