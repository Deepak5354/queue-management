import { Router } from "express";
import { buildInsights, type Snapshot as SnapshotPoint, type Visit } from "../lib/analytics.js";
import { Queue } from "../models/queue.js";
import { Snapshot } from "../models/snapshot.js";
import { Token } from "../models/token.js";

export const insightsRouter = Router();

const DAY_MS = 86_400_000;
const ms = (value: Date | null | undefined) => (value ? value.getTime() : null);

insightsRouter.get("/insights", async (req, res) => {
  const range = req.query.range === "week" ? "week" : "today";
  const offset = Number(req.query.tz);
  const tzOffsetMin = Number.isFinite(offset) ? offset : 0;
  const now = Date.now();
  const since = new Date(now - 8 * DAY_MS);

  const [queues, snapshots, tokens] = await Promise.all([
    Queue.find({ userId: req.userId }).sort({ createdAt: 1 }).lean(),
    Snapshot.find({ userId: req.userId, at: { $gt: since } }).lean(),
    Token.find({
      userId: req.userId,
      $or: [
        { status: { $in: ["waiting", "serving"] } },
        { createdAt: { $gt: since } },
        { calledAt: { $gt: since } },
        { completedAt: { $gt: since } },
        { cancelledAt: { $gt: since } },
      ],
    }).lean(),
  ]);

  const byId = new Map(queues.map((queue) => [String(queue._id), queue]));
  const points: SnapshotPoint[] = snapshots.map((row) => ({
    queueId: String(row.queueId),
    waiting: row.waiting,
    at: row.at.getTime(),
  }));
  const visits: Visit[] = tokens.flatMap((token) => {
    const queue = byId.get(String(token.queueId));
    if (!queue) return [];
    return [
      {
        id: String(token._id),
        queueId: String(queue._id),
        queueName: queue.name,
        code: queue.code,
        number: token.number,
        personName: token.personName,
        status: token.status as Visit["status"],
        createdAt: token.createdAt.getTime(),
        calledAt: ms(token.calledAt),
        completedAt: ms(token.completedAt),
        cancelledAt: ms(token.cancelledAt),
      },
    ];
  });

  res.json(
    buildInsights({
      now,
      tzOffsetMin,
      range,
      queues: queues.map((queue) => ({ id: String(queue._id), name: queue.name, code: queue.code })),
      snapshots: points,
      visits,
    }),
  );
});
