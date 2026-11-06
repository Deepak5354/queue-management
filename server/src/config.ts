import "dotenv/config";

const env = process.env.NODE_ENV ?? "development";
const isProd = env === "production";
const isTest = env === "test";

function read(key: string): string | undefined {
  const value = process.env[key]?.trim();
  return value ? value : undefined;
}

function jwtSecret(): string {
  const configured = read("JWT_SECRET");
  if (configured) return configured;
  if (isProd) throw new Error("JWT_SECRET is not set. Add a long random string to the environment.");
  return "dev-only-secret-change-me";
}

export const config = {
  env,
  isProd,
  isTest,
  port: Number(read("PORT") ?? 4000),
  /** MongoDB connection string. Optional in development (an in-memory database is used instead). */
  mongoUri: read("MONGODB_URI"),
  jwtSecret: jwtSecret(),
  /** Public URL of the app, used for password reset links and the origin check. */
  appUrl: (read("APP_URL") ?? "http://localhost:3000").replace(/\/+$/, ""),
  resendApiKey: read("RESEND_API_KEY"),
  resetEmailFrom: read("RESET_EMAIL_FROM"),
  /** True when a real email provider is configured for password reset emails. */
  emailConfigured: Boolean(read("RESEND_API_KEY") && read("RESET_EMAIL_FROM")),
  /**
   * DEMO ONLY. When true, and no email provider is configured, "Forgot password"
   * returns the reset link in the response so a reviewer can try the flow without
   * an inbox. This lets anyone who knows an email reset that account, so never
   * turn it on for a site with real users.
   */
  demoResetLinks: read("DEMO_SHOW_RESET_LINK") === "true",
  /** Name of the session cookie. */
  cookieName: "qd_session",
  sessionDays: 7,
};
