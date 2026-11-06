import { Router } from "express";
import { HttpError } from "../lib/errors.js";
import { nextCode, sampleQueues, snapshotsFor } from "../lib/sample.js";
import { Queue } from "../models/queue.js";
import { Snapshot } from "../models/snapshot.js";
import { Token } from "../models/token.js";

export const demoRouter = Router();

const minutesAgo = (now: number, minutes: number) => new Date(now - minutes * 60_000);

/** Add two queues with a morning of realistic waits. Existing queues are untouched. */
demoRouter.post("/demo", async (req, res) => {
  const existing = await Queue.find({ userId: req.userId }).select("code name").lean();
  if (existing.length + 2 > 30) throw new HttpError(400, "Free two queue slots before loading demo data.");

  const takenCodes = new Set(existing.map((row) => row.code));
  const usedNames = new Set(existing.map((row) => row.name));
  const now = Date.now();
  let firstId = "";

  for (const plan of sampleQueues()) {
    const code = nextCode(takenCodes, plan.baseCode);
    takenCodes.add(code);
    let name = plan.name;
    for (let n = 2; usedNames.has(name); n += 1) name = `${plan.name} ${n}`;
    usedNames.add(name);

    const queue = await Queue.create({
      userId: req.userId,
      name,
      code,
      nextNumber: plan.tokens.length + 1,
    });
    if (!firstId) firstId = String(queue._id);

    await Token.insertMany(
      plan.tokens.map((token) => ({
        userId: req.userId,
        queueId: queue._id,
        number: token.number,
        personName: token.person,
        note: "",
        status: token.status,
        position: token.position,
        createdAt: minutesAgo(now, token.createdMinAgo),
        calledAt: token.calledMinAgo == null ? null : minutesAgo(now, token.calledMinAgo),
        completedAt: token.completedMinAgo == null ? null : minutesAgo(now, token.completedMinAgo),
        cancelledAt: token.cancelledMinAgo == null ? null : minutesAgo(now, token.cancelledMinAgo),
      })),
    );
    await Snapshot.insertMany(
      snapshotsFor(plan.tokens, plan.fromMinAgo, 20).map((point) => ({
        userId: req.userId,
        queueId: queue._id,
        waiting: point.waiting,
        at: minutesAgo(now, point.minAgo),
      })),
    );
  }
  res.status(201).json({ ok: true, queueId: firstId });
});
