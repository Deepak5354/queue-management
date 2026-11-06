import { useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, PlusCircle, Trash2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { deleteQueue } from "@/lib/queue/api";
import { Board } from "@/components/desk/board";
import { EditQueue } from "@/components/desk/edit-queue";
import { useDesk, useRefreshDesk } from "@/components/desk/desk-state";

export const Route = createFileRoute("/_app/queues/$queueId")({
  head: () => ({ meta: [{ title: "Queue · Queue Desk" }] }),
  component: QueuePage,
});

function QueuePage() {
  const { queueId } = Route.useParams();
  const { queues, ready } = useDesk();
  const queue = queues.find((item) => item.id === queueId);
  const refresh = useRefreshDesk();
  const navigate = useNavigate();
  const remove = useMutation({
    mutationFn: async () => {
      const result = await deleteQueue({ data: { queueId } });
      if (!result.ok) throw new Error(result.error);
    },
    onSuccess: async () => {
      toast.success("Queue deleted");
      await refresh();
      await navigate({ to: "/queues" });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not delete the queue."),
  });

  if (!queue) {
    if (!ready) return <div className="skeleton h-40" aria-hidden="true" />;
    return (
      <div className="panel max-w-lg p-6">
        <h1 className="text-3xl font-extrabold leading-tight">That queue is gone</h1>
        <p className="mt-3 text-muted">It may have been deleted. Your other queues are still here.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link to="/queues" className="btn btn-line">
            All queues
          </Link>
          <Link to="/queues/new" className="btn btn-primary">
            Create new queue
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rise space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/queues" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden="true" />
          All queues
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <EditQueue queue={queue} />
          <Link to="/queues/new" className="btn btn-line min-h-10">
            <PlusCircle className="size-4" aria-hidden="true" />
            New queue
          </Link>
        </div>
      </div>
      <Board queue={queue} />
      <DeleteQueue name={queue.name} pending={remove.isPending} onDelete={() => remove.mutate()} />
    </div>
  );
}

function DeleteQueue({ name, pending, onDelete }: { name: string; pending: boolean; onDelete: () => void }) {
  const [armed, setArmed] = useState(false);
  return (
    <div className="border-t border-line pt-5">
      {armed ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-accent-soft px-4 py-3">
          <p className="text-sm font-medium text-accent">Delete {name} and every token in it?</p>
          <button type="button" className="btn btn-danger min-h-10" disabled={pending} onClick={onDelete}>
            {pending ? "Deleting…" : "Delete queue"}
          </button>
          <button type="button" className="btn btn-ghost min-h-10" onClick={() => setArmed(false)}>
            Keep
          </button>
        </div>
      ) : (
        <button type="button" className="btn btn-ghost px-3" onClick={() => setArmed(true)}>
          <Trash2 className="size-4" aria-hidden="true" />
          Delete this queue
        </button>
      )}
    </div>
  );
}
