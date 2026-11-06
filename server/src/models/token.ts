import { Schema, model } from "mongoose";

export const TOKEN_STATUSES = ["waiting", "serving", "served", "cancelled"] as const;
export type TokenStatus = (typeof TOKEN_STATUSES)[number];

const tokenSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  queueId: { type: Schema.Types.ObjectId, ref: "Queue", required: true },
  number: { type: Number, required: true },
  personName: { type: String, required: true, trim: true, maxlength: 80 },
  note: { type: String, default: "", maxlength: 140 },
  status: { type: String, enum: TOKEN_STATUSES, default: "waiting" },
  /** Order within the waiting line (ascending). Only meaningful while waiting. */
  position: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  calledAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  cancelledAt: { type: Date, default: null },
});

tokenSchema.index({ queueId: 1, status: 1, position: 1 });
tokenSchema.index({ userId: 1, status: 1 });
tokenSchema.index({ queueId: 1, number: 1 }, { unique: true });

export const Token = model("Token", tokenSchema);
