import { Schema, model } from "mongoose";

const passwordResetSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  /** SHA-256 of the emailed token. The token itself is never stored. */
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
  usedAt: { type: Date, default: null },
});

// MongoDB removes expired reset requests automatically.
passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PasswordReset = model("PasswordReset", passwordResetSchema);
