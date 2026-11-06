import { useState, type FormEvent } from "react";
import { Link, createFileRoute, useRouterState } from "@tanstack/react-router";
import { AuthShell } from "@/components/desk/auth-shell";
import { requestPasswordReset } from "@/lib/auth/client";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Forgot password" }] }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const search = useRouterState({ select: (state) => state.location.searchStr });
  const preset = new URLSearchParams(search).get("email") ?? "";
  const [email, setEmail] = useState(preset);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [demoLink, setDemoLink] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSent(false);
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Enter a valid email address.");
      return;
    }
    setPending(true);
    try {
      const result = await requestPasswordReset(trimmed);
      if (!result.ok) {
        setError(result.error || "Could not start a reset just now. Try again.");
        return;
      }
      setDemoLink(result.demoLink ?? "");
      setSent(true);
    } catch {
      setError("Could not start a reset just now. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthShell>
      <div className="w-full">
        <h1 className="text-3xl font-extrabold tracking-tight text-ink">Reset your password</h1>
        <p className="mt-2 text-muted">Enter your account email and we will send you a reset link.</p>
        <form className="mt-7 space-y-4" onSubmit={onSubmit}>
          <label className="block">
            <span className="label">Email address</span>
            <input
              className="field"
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setSent(false);
                setDemoLink("");
              }}
              autoComplete="email"
              required
            />
          </label>
          {error ? (
            <p className="rounded-xl bg-accent-soft px-3.5 py-2.5 text-sm font-medium text-accent" role="alert">
              {error}
            </p>
          ) : null}
          {sent && demoLink ? (
            <div className="rounded-xl border border-warn/40 bg-warn-soft px-3.5 py-3 text-sm" role="status">
              <p className="font-semibold text-warn">Demo mode</p>
              <p className="mt-1 text-muted">
                This demo site does not send email, so here is your reset link. It expires in 15 minutes and works once.
              </p>
              <a href={demoLink} className="btn btn-line mt-3 w-full">
                Open reset link
              </a>
            </div>
          ) : sent ? (
            <p className="rounded-xl bg-success-soft px-3.5 py-2.5 text-sm text-success" role="status">
              If an account exists for that email, a reset link is on its way. Open it to choose a new password. The
              link expires in 15 minutes and works once.
            </p>
          ) : null}
          <button className="btn btn-primary btn-lg w-full" type="submit" disabled={pending}>
            {pending ? "Please wait…" : "Send reset link"}
          </button>
        </form>
        <p className="mt-6 text-sm">
          <Link to="/login" className="font-semibold text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
