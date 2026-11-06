import type { NextFunction, Request, Response } from "express";
import { config } from "../config.js";
import { HttpError } from "../lib/errors.js";

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ ok: false, error: "Not found." });
}

/** Turn any thrown error into the app's `{ ok: false, error }` JSON shape. */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ ok: false, error: err.message });
    return;
  }
  const e = err as { code?: number; type?: string; name?: string };
  if (e?.code === 11000) {
    res.status(409).json({ ok: false, error: "That already exists." });
    return;
  }
  if (e?.type === "entity.parse.failed" || e?.type === "entity.too.large") {
    res.status(400).json({ ok: false, error: "Invalid request." });
    return;
  }
  if (!config.isTest) console.error("[error]", err);
  res.status(500).json({ ok: false, error: "Something went wrong on our side. Please try again." });
}
