import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { clsx } from "clsx";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">{eyebrow}</p>
        ) : null}
        <h1 className="mt-1 text-3xl font-extrabold leading-tight text-ink sm:text-4xl">{title}</h1>
        {description ? <p className="mt-2 max-w-xl text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

type Tone = "primary" | "success" | "warn" | "danger";

const TONES: Record<Tone, string> = {
  primary: "bg-primary-soft text-primary",
  success: "bg-success-soft text-success",
  warn: "bg-warn-soft text-warn",
  danger: "bg-accent-soft text-accent",
};

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "primary",
  loading = false,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  tone?: Tone;
  loading?: boolean;
}) {
  return (
    <div className="panel p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted">{label}</p>
        <span className={clsx("grid size-9 place-items-center rounded-xl", TONES[tone])}>
          <Icon className="size-[1.1rem]" aria-hidden="true" />
        </span>
      </div>
      {loading ? (
        <div className="skeleton mt-3 h-8 w-16" aria-hidden="true" />
      ) : (
        <p className="mt-2 font-display text-3xl font-extrabold leading-none tabular-nums text-ink">{value}</p>
      )}
      {hint ? <p className="mt-2 truncate text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-sheet/60 px-6 py-10 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-primary-soft text-primary">
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <p className="mt-4 font-display text-lg font-bold text-ink">{title}</p>
      {children ? <div className="mt-1.5 max-w-sm text-sm text-muted">{children}</div> : null}
    </div>
  );
}

/** Round badge showing a queue's short code. */
export function CodeBadge({ code, size = "md" }: { code: string; size?: "md" | "lg" }) {
  return (
    <span
      className={clsx(
        "grid shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 font-display font-extrabold text-white shadow-sm shadow-indigo-500/30",
        size === "lg" ? "size-14 text-lg" : "size-11 text-sm",
      )}
    >
      {code}
    </span>
  );
}

export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="skeleton h-[4.5rem] w-full" />
      ))}
    </div>
  );
}
