import { config } from "../config.js";

const LOG = "[password-reset]";

/** Path (relative to the site) of the page where a reset token is redeemed. */
export const resetPath = (token: string) => `/reset-password?token=${encodeURIComponent(token)}`;

/**
 * Deliver a password reset link. Uses Resend when RESEND_API_KEY and
 * RESET_EMAIL_FROM are set; otherwise (development) prints the link to the
 * server console. Never throws: a delivery failure must not change the public
 * response, or callers could tell which emails are registered.
 */
export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  const link = `${config.appUrl}${resetPath(token)}`;
  const text = [
    "A password reset was requested for your Queue Desk account.",
    "",
    "Open this link to choose a new password. It expires in 15 minutes and works once:",
    link,
    "",
    "If you did not ask for this, you can ignore this email.",
  ].join("\n");

  try {
    if (config.resendApiKey && config.resetEmailFrom) {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${config.resendApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: config.resetEmailFrom, to: [email], subject: "Reset your password", text }),
      });
      if (!response.ok) console.error(`${LOG} email provider rejected the message`, response.status);
      return;
    }
    if (config.isProd) {
      console.error(`${LOG} email is not configured. Set RESEND_API_KEY and RESET_EMAIL_FROM.`);
    } else if (!config.isTest) {
      console.info(`${LOG} email is not configured. Reset link for ${email}:\n${link}`);
    }
  } catch (error) {
    console.error(`${LOG} could not send the reset email`, error);
  }
}
