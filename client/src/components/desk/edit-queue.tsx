import { useState, type FormEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useMutation } from "@tanstack/react-query";
import { Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { updateQueue, type QueueSummary } from "@/lib/queue/api";
import { useRefreshDesk } from "@/components/desk/desk-state";

/** "Edit" button plus the dialog for changing a queue's name and code. */
export function EditQueue({ queue }: { queue: QueueSummary }) {
  const refresh = useRefreshDesk();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(queue.name);
  const [code, setCode] = useState(queue.code);
  const [error, setError] = useState("");

  const save = useMutation({
    mutationFn: async (input: { name: string; code: string }) => {
      const result = await updateQueue({ data: { queueId: queue.id, ...input } });
      if (!result.ok) throw new Error(result.error);
      return result.queue;
    },
    onSuccess: async (updated) => {
      toast.success(`Saved ${updated.name}`);
      setOpen(false);
      await refresh(queue.id);
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Could not save the changes."),
  });

  function onOpenChange(next: boolean) {
    if (next) {
      // Start from the current values each time the dialog opens.
      setName(queue.name);
      setCode(queue.code);
      setError("");
    }
    setOpen(next);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (save.isPending) return;
    const nextName = name.trim();
    const nextCode = code.trim().toUpperCase();
    if (!nextName) {
      setError("Give the queue a name.");
      return;
    }
    if (!/^[A-Z0-9]{1,4}$/.test(nextCode)) {
      setError("Use a code of 1–4 letters or numbers.");
      return;
    }
    setError("");
    save.mutate({ name: nextName, code: nextCode });
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger asChild>
        <button type="button" className="btn btn-line min-h-10">
          <Pencil className="size-4" aria-hidden="true" />
          Edit
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm" />
        <Dialog.Content className="panel fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 p-6 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-xl font-bold">Edit queue</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted">
                Token numbers keep counting. Existing tokens will show the new code.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button type="button" className="icon-btn -mr-2 -mt-2 border-transparent shadow-none" aria-label="Close">
                <X className="size-4" aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>

          <form className="mt-5 space-y-4" onSubmit={onSubmit} noValidate>
            <div>
              <label className="label" htmlFor="edit-queue-name">
                Queue name
              </label>
              <input
                id="edit-queue-name"
                className="field"
                value={name}
                maxLength={60}
                onChange={(event) => {
                  setName(event.target.value);
                  setError("");
                }}
              />
            </div>
            <div>
              <label className="label" htmlFor="edit-queue-code">
                Code
              </label>
              <input
                id="edit-queue-code"
                className="field font-display font-bold uppercase tracking-wider"
                value={code}
                maxLength={4}
                onChange={(event) => {
                  setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4));
                  setError("");
                }}
              />
              <p className="mt-1.5 text-xs text-muted">Up to 4 letters or numbers.</p>
            </div>
            {error ? (
              <p className="rounded-xl bg-accent-soft px-3.5 py-2.5 text-sm font-medium text-accent" role="alert">
                {error}
              </p>
            ) : null}
            <div className="flex justify-end gap-2 pt-1">
              <Dialog.Close asChild>
                <button type="button" className="btn btn-ghost">
                  Cancel
                </button>
              </Dialog.Close>
              <button type="submit" className="btn btn-primary" disabled={save.isPending}>
                {save.isPending ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
