import { Types } from "mongoose";
import { Queue } from "../models/queue.js";
import { Snapshot } from "../models/snapshot.js";
import { Token } from "../models/token.js";

export type QueueSummary = {
  id: string;
  name: string;
  code: string;
  waiting: number;
  servingName: string | null;
  servingNumber: number | null;
  createdAt: string;
};

export type TokenRow = {
  id: string;
  number: number;
  personName: string;
  note: string;
  status: "waiting" | "serving" | "served" | "cancelled";
  position: number;
  createdAt: string;
  calledAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
};

const iso = (value: Date | null | undefined) => (value ? value.toISOString() : null);

/** Every queue the manager owns, with live waiting and serving info. */
export async function queueSummaries(userId: string): Promise<QueueSummary[]> {
  const [queues, active] = await Promise.all([
    Queue.find({ userId }).sort({ createdAt: 1 }).lean(),
    Token.find({ userId, status: { $in: ["waiting", "serving"] } })
      .select("queueId status number personName")
      .lean(),
  ]);
  return queues.map((queue) => {
    const mine = active.filter((token) => String(token.queueId) === String(queue._id));
    const serving = mine.find((token) => token.status === "serving");
    return {
      id: String(queue._id),
      name: queue.name,
      code: queue.code,
      waiting: mine.filter((token) => token.status === "waiting").length,
      servingName: serving?.personName ?? null,
      servingNumber: serving?.number ?? null,
      createdAt: iso(queue.createdAt as Date | undefined) ?? new Date().toISOString(),
    };
  });
}

type TokenLike = {
  _id: Types.ObjectId;
  number: number;
  personName: string;
  note?: string | null;
  status: TokenRow["status"];
  position?: number | null;
  createdAt: Date;
  calledAt?: Date | null;
  completedAt?: Date | null;
  cancelledAt?: Date | null;
};

export function toTokenRow(token: TokenLike): TokenRow {
  return {
    id: String(token._id),
    number: token.number,
    personName: token.personName,
    note: token.note ?? "",
    status: token.status,
    position: token.position ?? 0,
    createdAt: token.createdAt.toISOString(),
    calledAt: iso(token.calledAt),
    completedAt: iso(token.completedAt),
    cancelledAt: iso(token.cancelledAt),
  };
}

/** Record how many people are waiting now. Powers the queue length chart. */
export async function recordSnapshot(userId: string, queueId: string | Types.ObjectId): Promise<void> {
  const waiting = await Token.countDocuments({ userId, queueId, status: "waiting" });
  await Snapshot.create({ userId, queueId, waiting });
}
