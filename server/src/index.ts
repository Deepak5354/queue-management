import { createApp } from "./app.js";
import { config } from "./config.js";
import { connectDb, disconnectDb } from "./db.js";

async function main() {
  if (config.isProd && config.demoResetLinks) {
    console.warn("[server] DEMO_SHOW_RESET_LINK is on: reset links are shown on screen. Demo sites only.");
  }
  await connectDb();
  const app = createApp();
  const server = app.listen(config.port, () => {
    console.info(`[server] Queue Desk API listening on http://localhost:${config.port}`);
  });

  const shutdown = (signal: string) => {
    console.info(`[server] ${signal} received, shutting down`);
    server.close(() => {
      void disconnectDb().finally(() => process.exit(0));
    });
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((error) => {
  console.error("[server] failed to start", error);
  process.exit(1);
});
