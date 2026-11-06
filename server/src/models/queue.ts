import { Schema, model } from "mongoose";

const queueSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    code: { type: String, required: true, uppercase: true, trim: true, maxlength: 4 },
    /** The number the next token will get. Token numbers are never reused. */
    nextNumber: { type: Number, default: 1 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

queueSchema.index({ userId: 1, createdAt: 1 });
// A manager cannot have two queues with the same code.
queueSchema.index({ userId: 1, code: 1 }, { unique: true });

export const Queue = model("Queue", queueSchema);
