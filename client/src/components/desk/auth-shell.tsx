import type { ReactNode } from "react";
import { BarChart3, Check, ListOrdered, Ticket } from "lucide-react";
import { ThemeToggle } from "@/components/desk/theme-toggle";

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        className={
          light
            ? "grid size-9 place-items-center rounded-xl bg-white/15 text-white ring-1 ring-white/25"
            : "grid size-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-md shadow-indigo-500/30"
        }
      >
        <ListOrdered className="size-5" strokeWidth={2.25} aria-hidden="true" />
      </span>
      <span className={light ? "font-display text-lg font-bold text-white" : "font-display text-lg font-bold text-ink"}>
        Queue Desk
      </span>
    </span>
  );
}

const POINTS = [
  { icon: Ticket, text: "Issue a numbered token the moment someone joins" },
  { icon: ListOrdered, text: "Reorder the line and call the next person in one click" },
  { icon: BarChart3, text: "See wait times and queue length trends as they happen" },
];

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-900 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-violet-400/30 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -left-16 size-96 rounded-full bg-sky-400/20 blur-3xl"
        />
        <Logo light />
        <div className="relative max-w-md">
          <h2 className="text-4xl font-extrabold leading-[1.1] tracking-tight">
            Shorter lines. Calmer counters.
          </h2>
          <p className="mt-4 text-indigo-100">
            Run every queue from one desk. Know who is next, who has waited longest, and how the day is going.
          </p>
          <ul className="mt-8 space-y-4">
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-sm text-indigo-50">
                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-white/15 ring-1 ring-white/20">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative flex items-center gap-2 text-xs text-indigo-200">
          <Check className="size-4" aria-hidden="true" />
          Your queues are private to your account.
        </p>
      </aside>
      <div className="relative flex flex-col justify-center px-5 py-10 sm:px-10">
        <div className="absolute right-4 top-4">
          <ThemeToggle labeled />
        </div>
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          {children}
        </div>
      </div>
    </main>
  );
}
