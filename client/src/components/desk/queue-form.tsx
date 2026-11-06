import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createQueue, type DeskPayload } from "@/lib/queue/api";
import { nextCode, suggestCode } from "@/lib/queue/format";
import { DESK_QUERY_KEY, useRefreshDesk } from "@/components/desk/desk-state";

export function QueueForm({ taken }: { taken: string[] }) {
  const navigate = useNavigate();
  const refresh = useRefreshDesk();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [codeDirty, setCodeDirty] = useState(false);
  const [error, setError] = useState("");
  const create = useMutation({
    mutationFn: async (input: { name: string; code: string }) => {
      const result = await createQueue({ data: input });
      if (!result.ok) throw new Error(result.error);
      return result.queue;
    },
    onSuccess: async (queue) => {
      queryClient.setQueryData<DeskPayload>(DESK_QUERY_KEY, (current) => {
        if (!current?.authed) return current;
        if (current.queues.some((item) => item.id === queue.id)) return current;
        return { ...current, queues: [...current.queues, queue] };
      });
      setName("");
      setCode("");
      setCodeDirty(false);
      setError("");
      toast.success(`${queue.name} is open`);
      await navigate({ to: "/queues/$queueId", params: { queueId: queue.id } });
      void refresh();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Could not create the queue."),
  });

  return (
    <form
      className="mt-4 space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (create.isPending) return;
        const nextName = name.trim();
        const nextCodeValue = code.trim().toUpperCase();
        if (!nextName) {
          setError("Give the queue a name.");
          return;
        }
        if (!/^[A-Z0-9]{1,4}$/.test(nextCodeValue)) {
          setError("Use a code of 1–4 letters or numbers.");
          return;
        }
        setError("");
        create.mutate({ name: nextName, code: nextCodeValue });
      }}
    >
      <label className="block">
        <span className="label">Queue name</span>
        <input
          className="field"
          value={name}
          maxLength={60}
          placeholder="Front desk"
          onChange={(event) => {
            const next = event.target.value;
            setName(next);
            if (!codeDirty) setCode(nextCode(new Set(taken), suggestCode(next) || "Q"));
          }}
          required
        />
      </label>
      <label className="block">
        <span className="label">Code</span>
        <input
          className="field font-display font-bold uppercase tracking-wider"
          value={code}
          maxLength={4}
          placeholder="A"
          onChange={(event) => {
            setCodeDirty(true);
            setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4));
          }}
          required
        />
      </label>
      <p className="-mt-2 text-xs text-muted">Up to 4 letters or numbers. Tokens look like {code || "A"}-001.</p>
      {error ? (
        <p className="rounded-xl bg-accent-soft px-3.5 py-2.5 text-sm font-medium text-accent" role="alert">
          {error}
        </p>
      ) : null}
      <button className="btn btn-primary btn-lg w-full" type="submit" disabled={create.isPending}>
        {create.isPending ? "Creating…" : "Create queue"}
      </button>
    </form>
  );
}
