import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Check, GripVertical, Megaphone, UserPlus, Users, X } from "lucide-react";
import { toast } from "sonner";
import { clsx } from "clsx";
import { addToken, callNext, cancelToken, finishService, listTokens, moveToken, moveTokenTo, type QueueSummary, type TokenRow } from "@/lib/queue/api";
import { useRefreshDesk } from "@/components/desk/desk-state";
import { formatClock, formatToken } from "@/lib/queue/format";
import { CodeBadge, EmptyState, ListSkeleton } from "@/components/desk/ui";

function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

export function Board({ queue }: { queue: QueueSummary }) {
  const now = useNow();
  const refreshDesk = useRefreshDesk();
  const [person, setPerson] = useState("");
  const [note, setNote] = useState("");
  const [armed, setArmed] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const tokensQuery = useQuery({
    queryKey: ["tokens", queue.id],
    queryFn: async () => {
      const result = await listTokens({ data: { queueId: queue.id } });
      if (!Array.isArray(result)) throw new Error(result.error);
      return result;
    },
    refetchInterval: 12_000,
  });

  function refresh() {
    return refreshDesk(queue.id);
  }

  const issue = useMutation({
    mutationFn: async () => {
      const result = await addToken({ data: { queueId: queue.id, personName: person, note } });
      if (!result.ok) throw new Error(result.error);
      return result;
    },
    onSuccess: async (result) => {
      setPerson("");
      setNote("");
      toast.success(`Token ${formatToken(result.code, result.number)} issued`);
      await refresh();
    },
    onError: (error) => toast.error(messageOf(error)),
  });

  const move = useMutation({
    mutationFn: async (input: { tokenId: string; direction: "up" | "down" }) => {
      const result = await moveToken({ data: input });
      if (!result.ok) throw new Error(result.error);
    },
    onSuccess: () => refresh(),
    onError: (error) => toast.error(messageOf(error)),
  });

  // Drag and drop: update the list immediately, then save. Roll back if saving fails.
  const reorder = useMutation({
    mutationFn: async (input: { tokenId: string; toIndex: number }) => {
      const result = await moveTokenTo({ data: input });
      if (!result.ok) throw new Error(result.error);
    },
    onMutate: async ({ tokenId, toIndex }) => {
      const key = ["tokens", queue.id];
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<TokenRow[]>(key);
      if (previous) {
        const line = previous.filter((token) => token.status === "waiting");
        const from = line.findIndex((token) => token.id === tokenId);
        if (from >= 0) {
          const next = [...line];
          const [moved] = next.splice(from, 1);
          next.splice(toIndex, 0, moved);
          queryClient.setQueryData<TokenRow[]>(key, [
            ...previous.filter((token) => token.status === "serving"),
            ...next,
            ...previous.filter((token) => token.status !== "serving" && token.status !== "waiting"),
          ]);
        }
      }
      return { previous };
    },
    onError: (error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(["tokens", queue.id], context.previous);
      toast.error(messageOf(error));
    },
    onSettled: () => refresh(),
  });

  const call = useMutation({
    mutationFn: async () => {
      const result = await callNext({ data: { queueId: queue.id } });
      if (!result.ok) throw new Error(result.error);
      return result.called;
    },
    onSuccess: async (called) => {
      if (!called) toast.message("No one is waiting.");
      else toast.success(`${formatToken(called.code, called.number)} · ${called.personName} is up`);
      await refresh();
    },
    onError: (error) => toast.error(messageOf(error)),
  });

  const finish = useMutation({
    mutationFn: async () => {
      const result = await finishService({ data: { queueId: queue.id } });
      if (!result.ok) throw new Error(result.error);
      return result.personName;
    },
    onSuccess: async (name) => {
      toast.success(name ? `${name} is served` : "Service finished");
      await refresh();
    },
    onError: (error) => toast.error(messageOf(error)),
  });

  const cancel = useMutation({
    mutationFn: async (tokenId: string) => {
      const result = await cancelToken({ data: { tokenId } });
      if (!result.ok) throw new Error(result.error);
      return result.personName;
    },
    onSuccess: async (name) => {
      setArmed(null);
      toast.success(`${name} cancelled`);
      await refresh();
    },
    onError: (error) => toast.error(messageOf(error)),
  });

  const tokens = tokensQuery.data ?? [];
  const serving = tokens.find((token) => token.status === "serving") ?? null;
  const waiting = tokens.filter((token) => token.status === "waiting");
  const recent = tokens.filter((token) => token.status === "served" || token.status === "cancelled");
  const busy = call.isPending || finish.isPending || issue.isPending;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <CodeBadge code={queue.code} size="lg" />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Queue {queue.code}</p>
            <h1 className="truncate text-3xl font-extrabold leading-tight sm:text-4xl">{queue.name}</h1>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="chip chip-muted tabular-nums">
            <Users className="size-3.5" aria-hidden="true" />
            {waiting.length} waiting
          </span>
          {serving ? (
            <span className="chip chip-success">
              <span className="pulse-dot" aria-hidden="true" />
              In service
            </span>
          ) : null}
        </div>
      </header>

      <section className={serving ? "ticket is-live" : "ticket"} aria-live="polite">
        <p className={serving ? "text-xs font-semibold uppercase tracking-wider text-indigo-200" : "text-xs font-semibold uppercase tracking-wider text-muted"}>
          Now serving
        </p>
        {serving ? (
          <div className="mt-3 flex flex-wrap items-end justify-between gap-5">
            <div className="min-w-0">
              <p className="font-display text-6xl font-extrabold leading-none tabular-nums sm:text-7xl">
                {formatToken(queue.code, serving.number)}
              </p>
              <p className="mt-3 truncate text-xl font-semibold">{serving.personName}</p>
              <p className="mt-1 text-sm tabular-nums text-indigo-200">
                Waited {serving.calledAt ? formatClock(serving.createdAt, new Date(serving.calledAt).getTime()) : "—"}
                {" · "}in service {serving.calledAt ? formatClock(serving.calledAt, now) : "—"}
              </p>
            </div>
            <button
              type="button"
              className="btn bg-white text-indigo-700 shadow-sm hover:bg-indigo-50 sm:mr-10"
              disabled={busy}
              onClick={() => finish.mutate()}
            >
              <Check className="size-4" aria-hidden="true" />
              {finish.isPending ? "Finishing…" : "Finish service"}
            </button>
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-4">
            <p className="font-display text-5xl font-extrabold leading-none text-slate-200">{queue.code}-000</p>
            <p className="max-w-xs text-sm text-muted">Nobody is being served. Assign the person at the top of the queue.</p>
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="button"
          className="btn btn-primary btn-lg w-full sm:w-auto"
          disabled={busy || waiting.length === 0}
          onClick={() => call.mutate()}
        >
          <Megaphone className="size-5" aria-hidden="true" />
          {call.isPending ? "Assigning…" : "Assign for service"}
        </button>
        <p className="text-sm text-muted">
          {waiting.length === 0
            ? "Add someone to the queue first."
            : serving
              ? `Finishes ${serving.personName}, then calls ${waiting[0].personName}.`
              : `Calls ${waiting[0].personName} (${formatToken(queue.code, waiting[0].number)}).`}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
        <section aria-labelledby="waiting-heading">
          <div className="flex items-baseline justify-between">
            <h2 id="waiting-heading" className="text-lg font-bold">
              Waiting
            </h2>
            <span className="text-sm tabular-nums text-muted">{waiting.length}</span>
          </div>
          {waiting.length > 1 ? (
            <p className="mt-0.5 text-xs text-muted">Drag a person to reorder, or use the arrows.</p>
          ) : null}
          {tokensQuery.isError ? (
            <p className="mt-3 rounded-xl bg-accent-soft px-3.5 py-2.5 text-sm font-medium text-accent" role="alert">
              {messageOf(tokensQuery.error)}
            </p>
          ) : tokensQuery.isLoading ? (
            <div className="mt-3">
              <ListSkeleton rows={3} />
            </div>
          ) : waiting.length === 0 ? (
            <div className="mt-3">
              <EmptyState icon={Users} title="Nobody is waiting">
                Add a person to issue the first token.
              </EmptyState>
            </div>
          ) : (
            <ol className="mt-3 space-y-2.5">
              {waiting.map((token, index) => (
                <TokenItem
                  key={token.id}
                  token={token}
                  code={queue.code}
                  index={index}
                  total={waiting.length}
                  now={now}
                  armed={armed === token.id}
                  pending={move.isPending || cancel.isPending || reorder.isPending}
                  dragging={dragId === token.id}
                  dropTarget={overId === token.id && dragId !== null && dragId !== token.id}
                  onDragStart={() => setDragId(token.id)}
                  onDragOver={() => setOverId(token.id)}
                  onDrop={() => {
                    if (dragId && dragId !== token.id) reorder.mutate({ tokenId: dragId, toIndex: index });
                    setDragId(null);
                    setOverId(null);
                  }}
                  onDragEnd={() => {
                    setDragId(null);
                    setOverId(null);
                  }}
                  onArm={() => setArmed(token.id)}
                  onDisarm={() => setArmed(null)}
                  onMove={(direction) => move.mutate({ tokenId: token.id, direction })}
                  onCancel={() => cancel.mutate(token.id)}
                />
              ))}
            </ol>
          )}
        </section>

        <aside className="space-y-6 lg:sticky lg:top-6">
          <form
            className="panel space-y-4 p-5"
            onSubmit={(event) => {
              event.preventDefault();
              if (!person.trim() || issue.isPending) return;
              issue.mutate();
            }}
          >
            <div>
              <h2 className="text-lg font-bold">Add to queue</h2>
              <p className="text-sm text-muted">Issues the next token for {queue.code}.</p>
            </div>
            <label className="block">
              <span className="label">Person</span>
              <input
                className="field"
                value={person}
                onChange={(event) => setPerson(event.target.value)}
                placeholder="Full name"
                maxLength={80}
                autoComplete="off"
                required
              />
            </label>
            <label className="block">
              <span className="label">
                Note <span className="font-normal text-muted">(optional)</span>
              </span>
              <input
                className="field"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="e.g. Needs wheelchair access"
                maxLength={140}
              />
            </label>
            <button className="btn btn-primary w-full" type="submit" disabled={issue.isPending}>
              <UserPlus className="size-4" aria-hidden="true" />
              {issue.isPending ? "Issuing…" : "Add to queue"}
            </button>
          </form>

          {recent.length > 0 ? (
            <section aria-labelledby="handled-heading" className="panel p-5">
              <h2 id="handled-heading" className="text-sm font-bold">
                Just handled
              </h2>
              <ul className="mt-3 space-y-3">
                {recent.map((token) => (
                  <li key={token.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate">
                      <span className="font-medium tabular-nums text-muted">{formatToken(queue.code, token.number)}</span>{" "}
                      {token.personName}
                    </span>
                    <span className={token.status === "cancelled" ? "chip chip-danger" : "chip chip-success"}>
                      {token.status === "cancelled" ? "Cancelled" : "Served"}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function TokenItem({
  token,
  code,
  index,
  total,
  now,
  armed,
  pending,
  dragging,
  dropTarget,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onArm,
  onDisarm,
  onMove,
  onCancel,
}: {
  token: TokenRow;
  code: string;
  index: number;
  total: number;
  now: number;
  armed: boolean;
  pending: boolean;
  dragging: boolean;
  dropTarget: boolean;
  onDragStart: () => void;
  onDragOver: () => void;
  onDrop: () => void;
  onDragEnd: () => void;
  onArm: () => void;
  onDisarm: () => void;
  onMove: (direction: "up" | "down") => void;
  onCancel: () => void;
}) {
  return (
    <li
      draggable={!armed && !pending}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", token.id);
        onDragStart();
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        onDragOver();
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDrop();
      }}
      onDragEnd={onDragEnd}
      className={clsx(
        "panel flex flex-col gap-3 p-3.5 transition-[opacity,box-shadow] sm:flex-row sm:items-center",
        armed && "border-accent/30 bg-accent-soft",
        dragging && "opacity-40",
        dropTarget && "ring-2 ring-indigo-500/60",
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <GripVertical
          className="hidden size-4 shrink-0 cursor-grab text-slate-300 active:cursor-grabbing sm:block"
          aria-hidden="true"
        />
        <span
          className={
            index === 0
              ? "grid size-9 shrink-0 place-items-center rounded-full bg-indigo-600 text-sm font-bold tabular-nums text-white"
              : "grid size-9 shrink-0 place-items-center rounded-full bg-slate-100 text-sm font-bold tabular-nums text-slate-500"
          }
        >
          {index + 1}
        </span>
        <div className="min-w-0">
          <p className="flex items-center gap-2">
            <span className="truncate font-semibold">{token.personName}</span>
            {index === 0 ? <span className="chip shrink-0">Next up</span> : null}
          </p>
          <p className="truncate text-sm tabular-nums text-muted">
            <span className="font-semibold text-slate-600">{formatToken(code, token.number)}</span> · waited{" "}
            {formatClock(token.createdAt, now)}
            {token.note ? ` · ${token.note}` : ""}
          </p>
        </div>
      </div>
      {armed ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-accent">Cancel {token.personName}?</span>
          <button type="button" className="btn btn-danger min-h-10" disabled={pending} onClick={onCancel}>
            Cancel token
          </button>
          <button type="button" className="btn btn-ghost min-h-10" onClick={onDisarm}>
            Keep
          </button>
        </div>
      ) : (
        <div className="flex shrink-0 gap-1.5">
          <button
            type="button"
            className="icon-btn"
            aria-label={`Move ${token.personName} up`}
            title="Move up"
            disabled={pending || index === 0}
            onClick={() => onMove("up")}
          >
            <ArrowUp className="size-4" strokeWidth={2} />
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label={`Move ${token.personName} down`}
            title="Move down"
            disabled={pending || index === total - 1}
            onClick={() => onMove("down")}
          >
            <ArrowDown className="size-4" strokeWidth={2} />
          </button>
          <button
            type="button"
            className="icon-btn danger"
            aria-label={`Cancel token for ${token.personName}`}
            title="Cancel token"
            disabled={pending}
            onClick={onArm}
          >
            <X className="size-4" strokeWidth={2} />
          </button>
        </div>
      )}
    </li>
  );
}
