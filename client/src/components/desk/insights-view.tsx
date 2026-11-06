import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CheckCircle2, Clock, Hourglass, Users } from "lucide-react";
import { getInsights } from "@/lib/queue/api";
import { formatMinutes } from "@/lib/queue/format";
import { PageHeader, StatCard } from "@/components/desk/ui";

const tipStyle = {
  background: "var(--color-sheet)",
  border: "1px solid var(--color-line)",
  borderRadius: 12,
  boxShadow: "0 8px 24px -8px rgb(15 23 42 / 0.2)",
  color: "var(--color-ink)",
  fontSize: 13,
};

export function InsightsView() {
  const [range, setRange] = useState<"today" | "week">("today");
  const query = useQuery({
    queryKey: ["insights", range],
    queryFn: () =>
      getInsights({
        data: { range, tzOffsetMinutes: new Date().getTimezoneOffset() },
      }),
    staleTime: 20_000,
  });

  const data = query.data;
  const trend = (data?.trend ?? []).map((point) => ({
    ...point,
    label: format(new Date(point.at), range === "today" ? "h a" : "EEE"),
  }));
  const hasTrend = trend.some((point) => point.waiting > 0) || trend.length > 1;
  const bars = (data?.byQueue ?? []).map((queue) => ({
    name: queue.code,
    full: queue.name,
    minutes: queue.avgWaitSec == null ? 0 : Math.round((queue.avgWaitSec / 60) * 10) / 10,
  }));

  return (
    <div className="rise space-y-6">
      <PageHeader
        eyebrow="All queues"
        title="Insights"
        description="Wait times and queue length trends across every queue."
        actions={
          <div className="inline-flex rounded-xl border border-line bg-sheet p-1 shadow-sm" role="group" aria-label="Date range">
            {(
              [
                ["today", "Today"],
                ["week", "7 days"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={range === id}
                className={
                  range === id
                    ? "min-h-10 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm"
                    : "min-h-10 rounded-lg px-4 text-sm font-medium text-muted hover:text-ink"
                }
                onClick={() => setRange(id)}
              >
                {label}
              </button>
            ))}
          </div>
        }
      />

      {query.isError ? (
        <p className="rounded-xl bg-accent-soft px-3.5 py-2.5 text-sm font-medium text-accent" role="alert">
          {query.error instanceof Error ? query.error.message : "Could not load insights."}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Waiting now" value={data ? String(data.waitingNow) : "—"} icon={Users} tone="warn" loading={query.isLoading} />
        <StatCard label="Served" value={data ? String(data.served) : "—"} icon={CheckCircle2} tone="success" loading={query.isLoading} />
        <StatCard label="Average wait" value={formatMinutes(data?.avgWaitSec ?? null)} icon={Clock} loading={query.isLoading} />
        <StatCard
          label="Longest wait now"
          value={formatMinutes(data?.longestWaitSec ?? null)}
          icon={Hourglass}
          tone="danger"
          loading={query.isLoading}
        />
      </div>

      <section className="panel p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-bold">Queue length</h2>
          <p className="text-sm text-muted">People waiting over time</p>
        </div>
        {query.isLoading ? (
          <div className="skeleton mt-4 h-56" aria-hidden="true" />
        ) : !hasTrend ? (
          <p className="mt-6 text-sm text-muted">The trend appears once people join a queue.</p>
        ) : (
          <div className="mt-4 h-60">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="queue-length-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--color-line)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "var(--color-muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} width={28} tick={{ fill: "var(--color-muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tipStyle} formatter={(value) => [value ?? 0, "Waiting"]} />
                <Area
                  type="monotone"
                  dataKey="waiting"
                  stroke="var(--color-primary)"
                  strokeWidth={2.5}
                  fill="url(#queue-length-fill)"
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="panel p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-lg font-bold">Average wait by queue</h2>
          <p className="text-sm text-muted">
            Service {formatMinutes(data?.avgServiceSec ?? null)} · cancelled {data?.cancelled ?? 0}
          </p>
        </div>
        {bars.length === 0 ? (
          <p className="mt-6 text-sm text-muted">Open a queue to compare waits.</p>
        ) : (
          <div className="mt-4 h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bars} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-line)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "var(--color-muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis width={32} tick={{ fill: "var(--color-muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: "rgb(79 70 229 / 0.06)" }}
                  contentStyle={tipStyle}
                  formatter={(value, _name, item) => [`${value ?? 0} min`, item.payload.full]}
                />
                <Bar dataKey="minutes" fill="var(--color-primary)" radius={[8, 8, 0, 0]} maxBarSize={52} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {data && data.bands.some((band) => band.count > 0) ? (
          <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-5 sm:grid-cols-4">
            {data.bands.map((band) => (
              <div key={band.label} className="rounded-xl bg-slate-50 px-3.5 py-3">
                <dt className="text-xs font-medium text-muted">{band.label}</dt>
                <dd className="font-display text-2xl font-extrabold tabular-nums">{band.count}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </section>

      <section className="panel p-5">
        <h2 className="text-lg font-bold">Recently handled</h2>
        {!data || data.recent.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Served and cancelled tokens show up here.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {data.recent.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3 text-sm">
                <span className="min-w-0">
                  <span className="font-semibold tabular-nums text-slate-600">{item.token}</span>{" "}
                  <span className="font-medium">{item.personName}</span>
                  <span className="text-muted"> · {item.queueName}</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className={item.status === "cancelled" ? "chip chip-danger" : "chip chip-success"}>
                    {item.status === "cancelled" ? "Cancelled" : `Served · waited ${formatMinutes(item.waitSec)}`}
                  </span>
                  <span className="tabular-nums text-muted">{format(new Date(item.at), "h:mm a")}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
