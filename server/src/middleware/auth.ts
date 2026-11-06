import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { HttpError } from "../lib/errors.js";
import { User } from "../models/user.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Set by `requireAuth`: the signed-in manager. */
      userId: string;
    }
  }
}

export function signSession(userId: string): string {
  return jwt.sign({}, config.jwtSecret, { subject: userId, expiresIn: config.sessionDays * 86_400 });
}

export function setSessionCookie(res: Response, userId: string) {
  res.cookie(config.cookieName, signSession(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: config.isProd,
    maxAge: config.sessionDays * 86_400_000,
    path: "/",
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(config.cookieName, { httpOnly: true, sameSite: "lax", secure: config.isProd, path: "/" });
}

/** The signed-in manager's id from the session cookie, or `null` when not signed in. */
export async function resolveUserId(req: Request): Promise<string | null> {
  const raw = req.cookies?.[config.cookieName];
  if (typeof raw !== "string" || !raw) return null;
  let payload: jwt.JwtPayload;
  try {
    const decoded = jwt.verify(raw, config.jwtSecret);
    if (typeof decoded === "string" || !decoded.sub) return null;
    payload = decoded;
  } catch {
    return null;
  }
  const user = await User.findById(payload.sub).select("passwordChangedAt").lean();
  if (!user) return null;
  // A password reset invalidates sessions issued before it.
  const changedAt = user.passwordChangedAt ? Math.floor(user.passwordChangedAt.getTime() / 1000) : 0;
  if ((payload.iat ?? 0) < changedAt) return null;
  return String(payload.sub);
}

/** Require a signed-in manager. Responds 401 otherwise. */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const userId = await resolveUserId(req);
  if (!userId) throw new HttpError(401, "Unauthorized");
  req.userId = userId;
  next();
}
