import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { updateName } from "@/lib/auth/client";
import { ME_QUERY_KEY } from "@/lib/auth/use-current-user";
import { useDesk, useRefreshDesk } from "@/components/desk/desk-state";
import { ChangePasswordCard } from "@/components/desk/change-password";
import { PageHeader } from "@/components/desk/ui";

export const Route = createFileRoute("/_app/profile")({
  head: () => ({ meta: [{ title: "Profile · Queue Desk" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { profile } = useDesk();
  const refresh = useRefreshDesk();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile.displayName ?? "");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const label = profile.displayName || profile.email || "Account";
  const initial = label.charAt(0).toUpperCase() || "A";

  useEffect(() => {
    if (!editing) setName(profile.displayName ?? "");
  }, [editing, profile.displayName]);

  async function onSave(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    const trimmed = name.trim().replace(/\s+/g, " ");
    if (trimmed.length < 2 || trimmed.length > 80) {
      setError("Use a name between 2 and 80 characters.");
      return;
    }
    setPending(true);
    try {
      const result = await updateName(trimmed);
      if (!result.ok) {
        setError(result.error || "Could not update the name.");
        return;
      }
      void queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
      await refresh();
      setEditing(false);
      setMessage("Name updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the name.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rise max-w-lg space-y-6">
      <PageHeader eyebrow="Account" title="Profile" />
      <div className="panel p-6">
        <div className="flex items-center gap-4">
          {profile.image ? (
            <img src={profile.image} alt="" className="h-14 w-14 rounded-full object-cover" />
          ) : (
            <span className="grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 text-lg font-bold text-white">{initial}</span>
          )}
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-ink">{profile.displayName || "Manager"}</p>
            <p className="truncate text-sm text-muted">{profile.email}</p>
          </div>
        </div>
        <dl className="mt-6 space-y-4 border-t border-line pt-5 text-sm">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-muted">Name</dt>
            {editing ? (
              <form className="mt-2 space-y-3" onSubmit={onSave}>
                <input
                  className="field"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                  maxLength={80}
                  required
                />
                <div className="flex gap-2">
                  <button className="btn btn-primary" type="submit" disabled={pending}>
                    {pending ? "Saving…" : "Save"}
                  </button>
                  <button
                    className="btn btn-line"
                    type="button"
                    onClick={() => {
                      setEditing(false);
                      setError("");
                      setName(profile.displayName ?? "");
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <dd className="mt-0.5 font-medium text-ink">{profile.displayName || "—"}</dd>
            )}
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-muted">Email</dt>
            <dd className="mt-0.5 font-medium text-ink">{profile.email || "—"}</dd>
            <p className="mt-1 text-xs text-muted">Email is the address used to sign in. It cannot be changed here.</p>
          </div>
        </dl>
        {error ? (
          <p className="mt-3 text-sm text-accent" role="alert">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="mt-3 text-sm text-success" role="status">
            {message}
          </p>
        ) : null}
        {!editing ? (
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary" onClick={() => setEditing(true)}>
              Edit profile
            </button>
          </div>
        ) : null}
      </div>
      <ChangePasswordCard />
    </div>
  );
}
