import { Router } from "express";
import { isValidObjectId } from "mongoose";
import { HttpError, notFound } from "../lib/errors.js";
import { recordSnapshot } from "../lib/serialize.js";
import { asString } from "../lib/text.js";
import { Token } from "../models/token.js";

export const tokensRouter = Router();

tokensRouter.post("/tokens/:id/cancel", async (req, res) => {
  const id = asString(req.params.id);
  if (!isValidObjectId(id)) throw notFound("token");
  const token = await Token.findOneAndUpdate(
    { _id: id, userId: req.userId, status: { $in: ["waiting", "serving"] } },
    { $set: { status: "cancelled", cancelledAt: new Date() } },
    { returnDocument: "after" },
  );
  if (!token) throw new HttpError(400, "That token can no longer be cancelled.");
  await recordSnapshot(req.userId, token.queueId);
  res.json({ ok: true, personName: token.personName });
});

/**
 * Reorder a waiting token. Send `{ direction: "up" | "down" }` for the arrow
 * buttons, or `{ toIndex }` (zero-based) for drag and drop.
 */
tokensRouter.patch("/tokens/:id/position", async (req, res) => {
  const id = asString(req.params.id);
  if (!isValidObjectId(id)) throw notFound("token");
  const token = await Token.findOne({ _id: id, userId: req.userId });
  if (!token) throw notFound("token");
  if (token.status !== "waiting") throw new HttpError(400, "Only people still waiting can be moved.");

  const line = await Token.find({ queueId: token.queueId, status: "waiting" })
    .sort({ position: 1, createdAt: 1 })
    .select("_id")
    .lean();
  const order = line.map((row) => String(row._id));
  const from = order.indexOf(String(token._id));
  if (from < 0) throw new HttpError(400, "That token is no longer waiting.");

  const body = (req.body ?? {}) as { direction?: unknown; toIndex?: unknown };
  let to: number;
  if (typeof body.toIndex === "number" && Number.isFinite(body.toIndex)) {
    to = Math.max(0, Math.min(order.length - 1, Math.trunc(body.toIndex)));
  } else {
    to = body.direction === "down" ? from + 1 : from - 1;
  }
  if (to < 0 || to >= order.length || to === from) {
    res.json({ ok: true });
    return;
  }

  const [moved] = order.splice(from, 1);
  order.splice(to, 0, moved);
  await Token.bulkWrite(
    order.map((tokenId, index) => ({
      updateOne: { filter: { _id: tokenId }, update: { $set: { position: index + 1 } } },
    })),
  );
  res.json({ ok: true });
});
