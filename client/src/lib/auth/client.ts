/** Sign-in, sign-up and account calls to the Express API. The session is an HttpOnly cookie. */

export type SessionUser = { id: string; name: string; email: string };

type AuthResult<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string; status?: number };

async function send<T extends object = object>(method: string, path: string, body?: unknown): Promise<AuthResult<T>> {
  let response: Response;
  try {
    response = await fetch(`/api/auth${path}`, {
      method,
      credentials: "same-origin",
      headers: method === "GET" ? undefined : { "content-type": "application/json" },
      body: method === "GET" ? undefined : JSON.stringify(body ?? {}),
    });
  } catch {
    return { ok: false, error: "Could not reach the server. Check your connection and try again." };
  }
  const json = (await response.json().catch(() => null)) as ({ error?: string } & Record<string, unknown>) | null;
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: typeof json?.error === "string" ? json.error : "Something went wrong. Please try again.",
    };
  }
  return { ok: true, ...(json as T) };
}

export const signUp = (input: { name: string; email: string; password: string }) =>
  send<{ user: SessionUser }>("POST", "/register", input);

export const signIn = (input: { email: string; password: string }) =>
  send<{ user: SessionUser }>("POST", "/login", input);

/** The signed-in user, or `null` when signed out. */
export async function fetchMe(): Promise<SessionUser | null> {
  const result = await send<{ user: SessionUser | null }>("GET", "/me");
  return result.ok ? result.user : null;
}

export const updateName = (name: string) => send<{ user: SessionUser }>("PATCH", "/me", { name });

/** In demo mode the server also returns `demoLink`, a relative reset link to show on screen. */
export const requestPasswordReset = (email: string) =>
  send<{ demoLink?: string }>("POST", "/forgot-password", { email });

export const changePassword = (currentPassword: string, newPassword: string) =>
  send("POST", "/change-password", { currentPassword, newPassword });

export const resetPassword = (token: string, password: string) =>
  send("POST", "/reset-password", { token, password });

/** End the session, then leave the desk. Throws if the server could not sign out. */
export async function signOut(redirectTo = "/login"): Promise<void> {
  const result = await send("POST", "/logout");
  if (!result.ok) throw new Error("Sign-out failed. You are still signed in.");
  window.location.replace(redirectTo);
}
