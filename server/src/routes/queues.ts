import { Router, type Request } from "express";
import { isValidObjectId } from "mongoose";
import { asString, cleanText } from "../lib/text.js";
import { HttpError, notFound } from "../lib/errors.js";
import { queueSummaries, recordSnapshot, toTokenRow } from "../lib/serialize.js";
import { Queue } from "../models/queue.js";
import { Snapshot } from "../models/snapshot.js";
import { Token } from "../models/token.js";
import { User } from "../models/user.js";

export const queuesRouter = Router();

const MAX_QUEUES = 30;
const CODE_PATTERN = /^[A-Z0-9]{1,4}$/;

/** Load a queue the signed-in manager owns, or respond 404. */
export async function ownedQueue(req: Request, id: string) {
  if (!isValidObjectId(id)) throw notFound();
  const queue = await Queue.findOne({ _id: id, userId: req.userId });
  if (!queue) throw notFound();
  return queue;
}

function parseQueueInput(body: unknown) {
  const input = (body ?? {}) as Record<string, unknown>;
  const name = cleanText(input.name, 60);
  const code = cleanText(input.code, 20).toUpperCase();
  if (!name) throw new HttpError(400, "Give the queue a name.");
  if (!CODE_PATTERN.test(code)) throw new HttpError(400, "Use a code of 1–4 letters or numbers.");
  return { name, code };
}

/** Everything the app shell needs in one call: who is signed in and their queues. */
queuesRouter.get("/desk", async (req, res) => {
  const [user, queues] = await Promise.all([
    User.findById(req.userId).select("name email").lean(),
    queueSummaries(req.userId),
  ]);
  res.json({
    authed: true,
    queues,
    profile: { displayName: user?.name ?? null, email: user?.email ?? null, image: null },
  });
});

queuesRouter.get("/queues", async (req, res) => {
  res.json(await queueSummaries(req.userId));
});

queuesRouter.post("/queues", async (req, res) => {
  const { name, code } = parseQueueInput(req.body);
  if ((await Queue.countDocuments({ userId: req.userId })) >= MAX_QUEUES) {
    throw new HttpError(400, `You can keep up to ${MAX_QUEUES} queues.`);
  }
  if (await Queue.exists({ userId: req.userId, code })) {
    throw new HttpError(409, `Code ${code} is already in use.`);
  }
  const queue = await Queue.create({ userId: req.userId, name, code });
  await recordSnapshot(req.userId, queue._id);
  res.status(201).json({
    ok: true,
    queue: {
      id: String(queue._id),
      name,
      code,
      waiting: 0,
      servingName: null,
      servingNumber: null,
      createdAt: new Date().toISOString(),
    },
  });
});

queuesRouter.patch("/queues/:id", async (req, res) => {
  const queue = await ownedQueue(req, asString(req.params.id));
  const { name, code } = parseQueueInput(req.body);
  if (await Queue.exists({ userId: req.userId, code, _id: { $ne: queue._id } })) {
    throw new HttpError(409, `Code ${code} is already in use.`);
  }
  queue.name = name;
  queue.code = code;
  await queue.save();
  res.json({ ok: true, queue: { id: String(queue._id), name, code } });
});

queuesRouter.delete("/queues/:id", async (req, res) => {
  const queue = await ownedQueue(req, asString(req.params.id));
  await Promise.all([
    Token.deleteMany({ queueId: queue._id }),
    Snapshot.deleteMany({ queueId: queue._id }),
    Queue.deleteOne({ _id: queue._id }),
  ]);
  res.json({ ok: true });
});

/** Waiting and serving tokens, plus the six most recently handled. */
queuesRouter.get("/queues/:id/tokens", async (req, res) => {
  const queue = await ownedQueue(req, asString(req.params.id));
  const [active, handled] = await Promise.all([
    Token.find({ queueId: queue._id, status: { $in: ["waiting", "serving"] } })
      .sort({ position: 1, createdAt: 1 })
      .lean(),
    Token.aggregate<Parameters<typeof toTokenRow>[0]>([
      { $match: { queueId: queue._id, status: { $in: ["served", "cancelled"] } } },
      {
        $addFields: {
          handledAt: { $ifNull: ["$completedAt", { $ifNull: ["$cancelledAt", "$createdAt"] }] },
        },
      },
      { $sort: { handledAt: -1 } },
      { $limit: 6 },
    ]),
  ]);
  const serving = active.filter((token) => token.status === "serving");
  const waiting = active.filter((token) => token.status === "waiting");
  res.json([...serving, ...waiting, ...handled].map(toTokenRow));
});

queuesRouter.post("/queues/:id/tokens", async (req, res) => {
  const queue = await ownedQueue(req, asString(req.params.id));
  const input = (req.body ?? {}) as Record<string, unknown>;
  const personName = cleanText(input.personName, 80);
  const note = cleanText(input.note, 140);
  if (!personName) throw new HttpError(400, "Add the person's name.");

  // Atomically take the next token number so two requests can never share one.
  const taken = await Queue.findOneAndUpdate({ _id: queue._id }, { $inc: { nextNumber: 1 } });
  if (!taken) throw notFound();
  const last = await Token.findOne({ queueId: queue._id, status: "waiting" }).sort({ position: -1 }).lean();
  const token = await Token.create({
    userId: req.userId,
    queueId: queue._id,
    number: taken.nextNumber,
    personName,
    note,
    position: (last?.position ?? 0) + 1,
  });
  await recordSnapshot(req.userId, queue._id);
  res.status(201).json({ ok: true, number: token.number, code: queue.code });
});

/** Assign the person at the top for service, finishing whoever was being served. */
queuesRouter.post("/queues/:id/call-next", async (req, res) => {
  const queue = await ownedQueue(req, asString(req.params.id));
  const next = await Token.findOneAndUpdate(
    { queueId: queue._id, status: "waiting" },
    { $set: { status: "serving", calledAt: new Date() } },
    { sort: { position: 1, createdAt: 1 }, returnDocument: "after" },
  );
  if (!next) {
    res.json({ ok: true, called: null });
    return;
  }
  await Token.updateMany(
    { queueId: queue._id, status: "serving", _id: { $ne: next._id } },
    { $set: { status: "served", completedAt: new Date() } },
  );
  await recordSnapshot(req.userId, queue._id);
  res.json({ ok: true, called: { number: next.number, personName: next.personName, code: queue.code } });
});

queuesRouter.post("/queues/:id/finish", async (req, res) => {
  const queue = await ownedQueue(req, asString(req.params.id));
  const done = await Token.findOneAndUpdate(
    { queueId: queue._id, status: "serving" },
    { $set: { status: "served", completedAt: new Date() } },
    { returnDocument: "after" },
  );
  if (!done) throw new HttpError(400, "No one is being served.");
  await recordSnapshot(req.userId, queue._id);
  res.json({ ok: true, personName: done.personName });
});

