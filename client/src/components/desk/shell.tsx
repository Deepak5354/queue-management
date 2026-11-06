import { useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { BarChart3, LayoutDashboard, ListOrdered, LogOut, PlusCircle, UserRound } from "lucide-react";
import { toast } from "sonner";
import { clsx } from "clsx";
import { signOut } from "@/lib/auth/client";
import { formatToken } from "@/lib/queue/format";
import type { DeskProfile, QueueSummary } from "@/lib/queue/api";
import { Logo } from "@/components/desk/auth-shell";
import { ThemeToggle } from "@/components/desk/theme-toggle";

type NavId = "dashboard" | "queues" | "create" | "insights" | "profile";

function activeNav(pathname: string, id: NavId) {
  if (id === "dashboard") return pathname === "/";
  if (id === "create") return pathname === "/queues/new";
  if (id === "insights") return pathname === "/insights";
  if (id === "profile") return pathname === "/profile";
  return pathname === "/queues" || (/^\/queues\/[^/]+$/.test(pathname) && pathname !== "/queues/new");
}

const NAV = [
  { id: "dashboard", to: "/", label: "Dashboard", icon: LayoutDashboard },
  { id: "queues", to: "/queues", label: "Queues", icon: ListOrdered },
  { id: "create", to: "/queues/new", label: "New queue", icon: PlusCircle },
  { id: "insights", to: "/insights", label: "Insights", icon: BarChart3 },
] as const;

export function Shell({
  profile,
  queues,
  children,
}: {
  profile: DeskProfile;
  queues: QueueSummary[];
  pending?: boolean;
  children: ReactNode;
}) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const queueId = /^\/queues\/(?!new$)[^/]+$/.test(pathname) ? pathname.slice("/queues/".length) : "";
  const [signingOut, setSigningOut] = useState(false);
  const accountLabel = profile.displayName || profile.email || "Profile";
  const initial = accountLabel.charAt(0).toUpperCase() || "M";

  function logout() {
    setSigningOut(true);
    void signOut("/login").catch((error) => {
      setSigningOut(false);
      toast.error(error instanceof Error ? error.message : "Sign-out failed. You are still signed in.");
    });
  }

  return (
    <div className="min-h-dvh md:flex">
      <a
        href="#desk"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-sheet focus:px-3 focus:py-2"
      >
        Skip to content
      </a>

      <aside className="flex flex-col border-b border-line bg-sheet md:sticky md:top-0 md:h-dvh md:w-64 md:shrink-0 md:overflow-y-auto md:border-b-0 md:border-r">
        <div className="flex items-center justify-between px-4 py-3 md:px-5 md:py-5">
          <Link to="/" aria-label="Queue Desk home">
            <Logo />
          </Link>
          <div className="flex items-center gap-1.5">
            {/* Phones show the icon here; larger screens have the labeled button in the sidebar footer. */}
            <div className="md:hidden">
              <ThemeToggle />
            </div>
            <Link
              to="/profile"
              aria-label="Profile"
              className="grid size-9 place-items-center rounded-full bg-primary-soft text-sm font-bold text-primary md:hidden"
            >
              {initial}
            </Link>
          </div>
        </div>

        <nav
          aria-label="Desk"
          className="flex gap-1.5 overflow-x-auto px-3 pb-3 md:flex-col md:overflow-visible md:pb-0"
        >
          {NAV.map(({ id, to, label, icon: Icon }) => {
            const active = activeNav(pathname, id);
            return (
              <Link
                key={id}
                to={to}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "inline-flex min-h-11 shrink-0 items-center gap-2.5 rounded-xl px-3.5 text-sm font-semibold transition-colors md:w-full",
                  active ? "bg-primary-soft text-primary" : "text-slate-600 hover:bg-slate-100 hover:text-ink",
                )}
              >
                <Icon className="size-[1.1rem]" aria-hidden="true" />
                {label}
              </Link>
            );
          })}
        </nav>

        {queues.length > 0 ? (
          <div className="mt-5 hidden px-3 md:block">
            <p className="px-3.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-slate-400">Your queues</p>
            <ul className="mt-2 space-y-0.5">
              {queues.map((queue) => (
                <li key={queue.id}>
                  <Link
                    to="/queues/$queueId"
                    params={{ queueId: queue.id }}
                    aria-current={queueId === queue.id ? "page" : undefined}
                    className={clsx(
                      "flex min-h-11 items-center gap-3 rounded-xl px-3.5 py-2 transition-colors",
                      queueId === queue.id ? "bg-slate-100" : "hover:bg-slate-50",
                    )}
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-slate-100 font-display text-xs font-bold text-slate-600">
                      {queue.code}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">{queue.name}</span>
                      <span className="block truncate text-xs text-muted">
                        {queue.servingName && queue.servingNumber != null
                          ? `Serving ${formatToken(queue.code, queue.servingNumber)}`
                          : queue.waiting === 0
                            ? "Idle"
                            : "Waiting"}
                      </span>
                    </span>
                    {queue.waiting > 0 ? (
                      <span className="chip tabular-nums">{queue.waiting}</span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-auto hidden border-t border-line p-3 md:block">
          <Link
            to="/profile"
            aria-current={activeNav(pathname, "profile") ? "page" : undefined}
            className={clsx(
              "flex min-h-12 items-center gap-3 rounded-xl px-3 transition-colors",
              activeNav(pathname, "profile") ? "bg-primary-soft" : "hover:bg-slate-50",
            )}
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 text-sm font-bold text-white">
              {initial}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-ink">{accountLabel}</span>
              {profile.email && profile.displayName ? (
                <span className="block truncate text-xs text-muted">{profile.email}</span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-muted">
                  <UserRound className="size-3" aria-hidden="true" /> Manager
                </span>
              )}
            </span>
          </Link>
          <ThemeToggle
            labeled
            className="mt-1 flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-ink"
          />
          <button
            type="button"
            className="mt-1 flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-ink disabled:cursor-wait disabled:opacity-60"
            disabled={signingOut}
            onClick={logout}
          >
            <LogOut className="size-4 shrink-0" aria-hidden="true" />
            {signingOut ? "Signing out…" : "Log out"}
          </button>
        </div>
      </aside>

      <main id="desk" className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-9">
          {children}
          <div className="mt-10 flex justify-center md:hidden">
            <button
              type="button"
              className="btn btn-ghost"
              disabled={signingOut}
              onClick={logout}
            >
              <LogOut className="size-4" aria-hidden="true" />
              {signingOut ? "Signing out…" : "Log out"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
