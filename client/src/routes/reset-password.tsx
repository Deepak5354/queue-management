import { useState, type FormEvent } from "react";
import { Link, createFileRoute, useRouterState } from "@tanstack/react-router";
import { AuthShell } from "@/components/desk/auth-shell";
import { resetPassword } from "@/lib/auth/client";
import { PasswordChecklist } from "@/components/desk/password-checklist";
import { PasswordField } from "@/components/desk/password-field";
import { passwordProblems } from "@/lib/auth/password-rules";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Reset password" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const search = useRouterState({ select: (state) => state.location.searchStr });
  const token = new URLSearchParams(search).get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const problems = passwordProblems(password);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!token) {
      setError("This reset link is missing or invalid.");
      return;
    }
    if (problems.length > 0) {
      setError(problems[0]);
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setPending(true);
    try {
      const result = await resetPassword(token, password);
      if (!result.ok) {
        setError(result.error || "This reset link is invalid or has expired. Request a new one.");
        return;
      }
      window.location.assign("/login?reset=1");
    } catch {
      setError("Could not update the password. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthShell>
      <div className="w-full">
        <h1 className="text-3xl font-extrabold tracking-tight text-ink">Choose a new password</h1>
        {!token ? (
          <p className="mt-4 rounded-xl bg-accent-soft px-3.5 py-2.5 text-sm font-medium text-accent" role="alert">
            This reset link is missing or invalid.
          </p>
        ) : (
          <form className="mt-7 space-y-4" onSubmit={onSubmit}>
            <PasswordField label="New password" name="new-password" value={password} onChange={setPassword} autoComplete="new-password" />
            <PasswordField
              label="Confirm new password"
              name="confirm-password"
              value={confirm}
              onChange={setConfirm}
              autoComplete="new-password"
            />
            <PasswordChecklist password={password} />
            {confirm ? (
              <p className={password === confirm ? "text-xs font-medium text-success" : "text-xs font-medium text-accent"}>
                {password === confirm ? "Passwords match." : "Passwords do not match."}
              </p>
            ) : null}
            {error ? (
              <p className="rounded-xl bg-accent-soft px-3.5 py-2.5 text-sm font-medium text-accent" role="alert">
                {error}
              </p>
            ) : null}
            <button className="btn btn-primary btn-lg w-full" type="submit" disabled={pending}>
              {pending ? "Please wait…" : "Update password"}
            </button>
          </form>
        )}
        <p className="mt-6 text-sm">
          <Link to="/forgot-password" className="font-semibold text-primary hover:underline">
            Request a new link
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
