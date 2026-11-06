import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { config } from "../config.js";
import { resetPath, sendPasswordResetEmail } from "../lib/email.js";
import { HttpError } from "../lib/errors.js";
import { clearSessionCookie, requireAuth, resolveUserId, setSessionCookie } from "../middleware/auth.js";
import { PasswordReset } from "../models/password-reset.js";
import { User } from "../models/user.js";

export const authRouter = Router();

// Slow down password guessing and signup spam.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => config.isTest,
  message: { ok: false, error: "Too many attempts. Please wait a few minutes and try again." },
});

const password = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(128, "Use at most 128 characters.")
  .regex(/[A-Za-z]/, "Include a letter.")
  .regex(/[0-9]/, "Include a number.");

const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(80, "Use a shorter name."),
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.")),
  password,
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase(),
  password: z.string().min(1).max(128),
});

function parse<T extends z.ZodType>(schema: T, body: unknown): z.infer<T> {
  const result = schema.safeParse(body);
  if (!result.success) throw new HttpError(400, result.error.issues[0]?.message ?? "Invalid request.");
  return result.data;
}

const publicUser = (user: { _id: unknown; name: string; email: string }) => ({
  id: String(user._id),
  name: user.name,
  email: user.email,
});

authRouter.post("/register", limiter, async (req, res) => {
  const input = parse(registerSchema, req.body);
  if (await User.exists({ email: input.email })) {
    throw new HttpError(409, "An account with this email already exists. Try signing in instead.");
  }
  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await User.create({ name: input.name, email: input.email, passwordHash });
  setSessionCookie(res, String(user._id));
  res.status(201).json({ ok: true, user: publicUser(user) });
});

authRouter.post("/login", limiter, async (req, res) => {
  const input = parse(loginSchema, req.body);
  const user = await User.findOne({ email: input.email });
  // Same message for unknown email and wrong password, so emails cannot be probed.
  const valid = user ? await bcrypt.compare(input.password, user.passwordHash) : false;
  if (!user || !valid) throw new HttpError(401, "Incorrect email or password.");
  setSessionCookie(res, String(user._id));
  res.json({ ok: true, user: publicUser(user) });
});

authRouter.post("/logout", (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

/** Who is signed in? Answers `user: null` (not an error) for visitors who are not. */
authRouter.get("/me", async (req, res) => {
  const userId = await resolveUserId(req);
  const user = userId ? await User.findById(userId).lean() : null;
  res.json({ ok: true, user: user ? publicUser(user) : null });
});

authRouter.patch("/me", requireAuth, async (req, res) => {
  const { name } = parse(z.object({ name: registerSchema.shape.name }), req.body);
  const user = await User.findByIdAndUpdate(req.userId, { name }, { returnDocument: "after" }).lean();
  if (!user) throw new HttpError(401, "Unauthorized");
  res.json({ ok: true, user: publicUser(user) });
});

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

authRouter.post("/forgot-password", limiter, async (req, res) => {
  const { email } = parse(z.object({ email: z.string().trim().toLowerCase().pipe(z.email()) }), req.body);
  const user = await User.findOne({ email }).lean();
  let demoLink: string | undefined;
  if (user) {
    const token = randomBytes(32).toString("hex");
    await PasswordReset.create({
      userId: user._id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });
    await sendPasswordResetEmail(user.email, token);
    if (config.demoResetLinks && !config.emailConfigured) demoLink = resetPath(token);
  }
  // The answer is the same whether or not the email is registered
  // (except in demo mode, where a registered email also gets its link).
  res.json(demoLink ? { ok: true, demoLink } : { ok: true });
});

/** Change the password of the signed-in manager. Other devices are signed out. */
authRouter.post("/change-password", requireAuth, limiter, async (req, res) => {
  const input = parse(
    z.object({ currentPassword: z.string().min(1, "Enter your current password.").max(128), newPassword: password }),
    req.body,
  );
  const user = await User.findById(req.userId);
  if (!user) throw new HttpError(401, "Unauthorized");
  if (!(await bcrypt.compare(input.currentPassword, user.passwordHash))) {
    throw new HttpError(400, "Your current password is incorrect.");
  }
  if (input.currentPassword === input.newPassword) {
    throw new HttpError(400, "Choose a new password that is different from the current one.");
  }
  user.passwordHash = await bcrypt.hash(input.newPassword, 12);
  user.passwordChangedAt = new Date();
  await user.save();
  // Sessions issued before now stop working; give this device a fresh one.
  setSessionCookie(res, String(user._id));
  res.json({ ok: true });
});

authRouter.post("/reset-password", limiter, async (req, res) => {
  const input = parse(z.object({ token: z.string().min(10), password }), req.body);
  const reset = await PasswordReset.findOneAndUpdate(
    { tokenHash: hashToken(input.token), usedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { usedAt: new Date() } },
  );
  if (!reset) throw new HttpError(400, "This reset link is invalid or has expired. Request a new one.");
  await User.findByIdAndUpdate(reset.userId, {
    passwordHash: await bcrypt.hash(input.password, 12),
    passwordChangedAt: new Date(),
  });
  res.json({ ok: true });
});
