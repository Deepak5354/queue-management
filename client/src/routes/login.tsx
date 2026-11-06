import { useEffect, useState } from "react";
import { createFileRoute, Navigate, useRouterState } from "@tanstack/react-router";
import { AuthCard } from "@/components/desk/auth-card";
import { AuthShell } from "@/components/desk/auth-shell";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in · Queue Desk" }] }),
  component: LoginPage,
});

function LoginPage() {
  const search = useRouterState({ select: (state) => state.location.searchStr });
  const reset = new URLSearchParams(search).get("reset") === "1";
  const { user } = useCurrentUserState();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (mounted && user) return <Navigate to="/" replace />;
  return (
    <AuthShell>
      <AuthCard notice={reset ? "Your password was updated. Sign in with the new password." : undefined} />
    </AuthShell>
  );
}
