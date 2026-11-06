import { Schema, model } from "mongoose";

/** Number of people waiting in a queue after each change. Feeds the queue length chart. */
const snapshotSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  queueId: { type: Schema.Types.ObjectId, ref: "Queue", required: true },
  waiting: { type: Number, required: true },
  at: { type: Date, default: Date.now },
});

snapshotSchema.index({ userId: 1, at: 1 });
snapshotSchema.index({ queueId: 1 });

export const Snapshot = model("Snapshot", snapshotSchema);
