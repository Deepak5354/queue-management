import { formatToken } from "./format.js";

export type Snapshot = { queueId: string; waiting: number; at: number };

export type Visit = {
  id: string;
  queueId: string;
  queueName: string;
  code: string;
  number: number;
  personName: string;
  status: "waiting" | "serving" | "served" | "cancelled";
  createdAt: number;
  calledAt: number | null;
  completedAt: number | null;
  cancelledAt: number | null;
};

export type QueueRef = { id: string; name: string; code: string };

export type Insights = {
  waitingNow: number;
  servingNow: number;
  served: number;
  cancelled: number;
  avgWaitSec: number | null;
  longestWaitSec: number | null;
  avgServiceSec: number | null;
  byQueue: {
    id: string;
    name: string;
    code: string;
    waiting: number;
    served: number;
    avgWaitSec: number | null;
  }[];
  bands: { label: string; count: number }[];
  trend: { at: string; waiting: number }[];
  recent: {
    id: string;
    personName: string;
    queueName: string;
    token: string;
    status: "served" | "cancelled";
    at: string;
    waitSec: number | null;
  }[];
};

function average(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** UTC instant of a local midnight. `tzOffsetMin` is `Date.getTimezoneOffset()`. */
export function localMidnight(nowMs: number, tzOffsetMin: number, daysBack: number) {
  const shifted = new Date(nowMs - tzOffsetMin * 60_000);
  shifted.setUTCHours(0, 0, 0, 0);
  shifted.setUTCDate(shifted.getUTCDate() - daysBack);
  return shifted.getTime() + tzOffsetMin * 60_000;
}

function sumWaitingAt(byQueue: Map<string, Snapshot[]>, queueIds: string[], at: number) {
  let sum = 0;
  for (const id of queueIds) {
    const points = byQueue.get(id);
    if (!points) continue;
    let value = 0;
    let found = false;
    for (const point of points) {
      if (point.at > at) break;
      value = point.waiting;
      found = true;
    }
    if (found) sum += value;
  }
  return sum;
}

function bandLabel(seconds: number) {
  const minutes = seconds / 60;
  if (minutes < 5) return "Under 5 min";
  if (minutes < 10) return "5–10 min";
  if (minutes < 20) return "10–20 min";
  return "20 min+";
}

const BANDS = ["Under 5 min", "5–10 min", "10–20 min", "20 min+"] as const;

export function buildInsights(input: {
  now: number;
  tzOffsetMin: number;
  range: "today" | "week";
  queues: QueueRef[];
  snapshots: Snapshot[];
  visits: Visit[];
}): Insights {
  const { now, queues, visits } = input;
  const tzOffsetMin = Math.min(14 * 60, Math.max(-14 * 60, input.tzOffsetMin));
  const rangeStart = localMidnight(now, tzOffsetMin, input.range === "week" ? 6 : 0);
  const queueIds = queues.map((queue) => queue.id);

  const waiting = visits.filter((visit) => visit.status === "waiting");
  const serving = visits.filter((visit) => visit.status === "serving");
  const servedVisits = visits.filter(
    (visit) =>
      visit.status === "served" &&
      visit.completedAt != null &&
      visit.completedAt >= rangeStart &&
      visit.completedAt <= now,
  );
  const cancelledVisits = visits.filter(
    (visit) =>
      visit.status === "cancelled" &&
      visit.cancelledAt != null &&
      visit.cancelledAt >= rangeStart &&
      visit.cancelledAt <= now,
  );

  const waits = visits.flatMap((visit) => {
    if (visit.calledAt == null || visit.calledAt < rangeStart || visit.calledAt > now) return [];
    return [Math.max(0, (visit.calledAt - visit.createdAt) / 1000)];
  });
  const services = servedVisits.flatMap((visit) => {
    if (visit.completedAt == null || visit.calledAt == null) return [];
    return [Math.max(0, (visit.completedAt - visit.calledAt) / 1000)];
  });

  const longestWaitSec =
    waiting.length === 0
      ? null
      : Math.max(...waiting.map((visit) => Math.max(0, (now - visit.createdAt) / 1000)));

  const byQueue = queues.map((queue) => {
    const queueWaits = visits.flatMap((visit) => {
      if (visit.queueId !== queue.id) return [];
      if (visit.calledAt == null || visit.calledAt < rangeStart || visit.calledAt > now) return [];
      return [Math.max(0, (visit.calledAt - visit.createdAt) / 1000)];
    });
    return {
      id: queue.id,
      name: queue.name,
      code: queue.code,
      waiting: waiting.filter((visit) => visit.queueId === queue.id).length,
      served: servedVisits.filter((visit) => visit.queueId === queue.id).length,
      avgWaitSec: average(queueWaits),
    };
  });

  const bandCounts = new Map<string, number>(BANDS.map((label) => [label, 0]));
  for (const seconds of waits) {
    const label = bandLabel(seconds);
    bandCounts.set(label, (bandCounts.get(label) ?? 0) + 1);
  }

  const grouped = new Map<string, Snapshot[]>();
  for (const snapshot of input.snapshots) {
    const list = grouped.get(snapshot.queueId) ?? [];
    list.push(snapshot);
    grouped.set(snapshot.queueId, list);
  }
  for (const list of grouped.values()) list.sort((a, b) => a.at - b.at);

  const trend: Insights["trend"] = [];
  if (input.range === "today") {
    const start = rangeStart;
    const localNow = new Date(now - tzOffsetMin * 60_000);
    const hour = localNow.getUTCHours();
    for (let h = 0; h <= hour; h += 1) {
      const bucketStart = start + h * 3_600_000;
      const lookup = Math.min(bucketStart + 3_600_000 - 1, now);
      trend.push({
        at: new Date(bucketStart).toISOString(),
        waiting: sumWaitingAt(grouped, queueIds, lookup),
      });
    }
  } else {
    for (let daysBack = 6; daysBack >= 0; daysBack -= 1) {
      const bucketStart = localMidnight(now, tzOffsetMin, daysBack);
      const lookup = daysBack === 0 ? now : bucketStart + 86_400_000 - 1;
      trend.push({
        at: new Date(bucketStart).toISOString(),
        waiting: sumWaitingAt(grouped, queueIds, lookup),
      });
    }
  }

  const recentItems: Array<Insights["recent"][number] & { sort: number }> = [];
  for (const visit of visits) {
    if (visit.status === "served" && visit.completedAt != null && visit.completedAt >= rangeStart && visit.completedAt <= now) {
      recentItems.push({
        id: visit.id,
        personName: visit.personName,
        queueName: visit.queueName,
        token: formatToken(visit.code, visit.number),
        status: "served",
        at: new Date(visit.completedAt).toISOString(),
        waitSec: visit.calledAt == null ? null : Math.max(0, (visit.calledAt - visit.createdAt) / 1000),
        sort: visit.completedAt,
      });
    } else if (
      visit.status === "cancelled" &&
      visit.cancelledAt != null &&
      visit.cancelledAt >= rangeStart &&
      visit.cancelledAt <= now
    ) {
      recentItems.push({
        id: visit.id,
        personName: visit.personName,
        queueName: visit.queueName,
        token: formatToken(visit.code, visit.number),
        status: "cancelled",
        at: new Date(visit.cancelledAt).toISOString(),
        waitSec: null,
        sort: visit.cancelledAt,
      });
    }
  }
  const recent = recentItems
    .sort((a, b) => b.sort - a.sort)
    .slice(0, 8)
    .map(({ sort: _sort, ...item }) => item);

  return {
    waitingNow: waiting.length,
    servingNow: serving.length,
    served: servedVisits.length,
    cancelled: cancelledVisits.length,
    avgWaitSec: average(waits),
    longestWaitSec,
    avgServiceSec: average(services),
    byQueue,
    bands: BANDS.map((label) => ({ label, count: bandCounts.get(label) ?? 0 })),
    trend,
    recent,
  };
}
