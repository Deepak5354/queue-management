import assert from "node:assert/strict";
import test from "node:test";
import { buildInsights, localMidnight, type Visit } from "../src/lib/analytics.js";

const queues = [
  { id: "q1", name: "Front desk", code: "A" },
  { id: "q2", name: "Pharmacy", code: "P" },
];

function visit(partial: Partial<Visit> & Pick<Visit, "id" | "status" | "createdAt">): Visit {
  return {
    queueId: "q1",
    queueName: "Front desk",
    code: "A",
    number: 1,
    personName: "Meera",
    calledAt: null,
    completedAt: null,
    cancelledAt: null,
    ...partial,
  };
}

test("local midnight respects a negative timezone offset", () => {
  const now = Date.parse("2026-11-05T03:48:00.000Z");
  const start = localMidnight(now, -330, 0);
  assert.equal(new Date(start).toISOString(), "2026-11-04T18:30:00.000Z");
});

test("insights count live waits and carry the length forward", () => {
  const now = Date.parse("2026-11-05T09:00:00.000Z");
  const insights = buildInsights({
    now,
    tzOffsetMin: 0,
    range: "today",
    queues,
    snapshots: [
      { queueId: "q1", waiting: 2, at: Date.parse("2026-11-05T08:10:00.000Z") },
      { queueId: "q2", waiting: 4, at: Date.parse("2026-11-05T08:40:00.000Z") },
    ],
    visits: [
      visit({
        id: "w",
        status: "waiting",
        createdAt: now - 10 * 60_000,
        number: 3,
      }),
      visit({
        id: "s",
        status: "served",
        createdAt: now - 20 * 60_000,
        calledAt: now - 12 * 60_000,
        completedAt: now - 5 * 60_000,
        number: 2,
        personName: "Rahul",
      }),
      visit({
        id: "c",
        status: "cancelled",
        queueId: "q2",
        queueName: "Pharmacy",
        code: "P",
        createdAt: now - 30 * 60_000,
        cancelledAt: now - 8 * 60_000,
        number: 4,
        personName: "Neha",
      }),
    ],
  });

  assert.equal(insights.waitingNow, 1);
  assert.equal(insights.served, 1);
  assert.equal(insights.cancelled, 1);
  assert.equal(insights.avgWaitSec, 8 * 60);
  assert.equal(insights.longestWaitSec, 10 * 60);
  assert.equal(insights.recent[0]?.personName, "Rahul");
  const nine = insights.trend.find((point) => point.at === "2026-11-05T09:00:00.000Z");
  assert.equal(nine?.waiting, 6);
});
