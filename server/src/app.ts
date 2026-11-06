import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import { config } from "./config.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { originCheck } from "./middleware/origin.js";
import { requireAuth } from "./middleware/auth.js";
import { authRouter } from "./routes/auth.js";
import { demoRouter } from "./routes/demo.js";
import { insightsRouter } from "./routes/insights.js";
import { queuesRouter } from "./routes/queues.js";
import { tokensRouter } from "./routes/tokens.js";

const here = path.dirname(fileURLToPath(import.meta.url));
/** The built React app. Express serves it in production so one service hosts everything. */
const clientDist = path.resolve(here, "../../client/dist");

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  // Behind Render/Heroku-style proxies, trust the forwarded protocol and host.
  if (config.isProd) app.set("trust proxy", 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          "font-src": ["'self'", "https://fonts.gstatic.com"],
          "img-src": ["'self'", "data:"],
          "upgrade-insecure-requests": config.isProd ? [] : null,
        },
      },
    }),
  );
  app.use(express.json({ limit: "50kb" }));
  app.use(cookieParser());

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  const api = express.Router();
  api.use(originCheck);
  api.use("/auth", authRouter);
  // Everything below needs a signed-in manager.
  api.use(requireAuth, queuesRouter, tokensRouter, insightsRouter, demoRouter);
  app.use("/api", api);
  app.use("/api", notFoundHandler);

  if (existsSync(clientDist)) {
    app.use(express.static(clientDist, { index: false, maxAge: config.isProd ? "1h" : 0 }));
    // Single-page app: every other page is handled by the React router.
    app.get(/^(?!\/api\/).*/, (_req, res) => {
      res.sendFile(path.join(clientDist, "index.html"));
    });
  }

  app.use(errorHandler);
  return app;
}
