import type { NextFunction, Request, Response } from "express";
import { config } from "../config.js";
import { HttpError } from "../lib/errors.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF guard for state-changing requests. Browsers always send an Origin header
 * on cross-site POST/PATCH/DELETE; reject it unless it is this app.
 * Requests with no Origin (curl, server-to-server) are not browser CSRF and pass.
 */
export function originCheck(req: Request, _res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method)) return next();
  const origin = req.get("origin");
  if (!origin) return next();
  const allowed = new Set([config.appUrl, `${req.protocol}://${req.get("host")}`]);
  if (!config.isProd) allowed.add("http://localhost:3000").add("http://127.0.0.1:3000");
  if (allowed.has(origin.replace(/\/+$/, ""))) return next();
  throw new HttpError(403, "Forbidden: cross-site request blocked");
}
