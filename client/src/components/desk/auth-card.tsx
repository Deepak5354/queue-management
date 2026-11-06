import { useId, useState, type FormEvent } from "react";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { Check, Loader2, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { signIn, signUp } from "@/lib/auth/client";
import { ME_QUERY_KEY } from "@/lib/auth/use-current-user";
import { passwordProblems } from "@/lib/auth/password-rules";
import { PasswordChecklist } from "@/components/desk/password-checklist";
import { PasswordField } from "@/components/desk/password-field";

type Field = "name" | "email" | "password" | "confirm";
type FieldErrors = Partial<Record<Field, string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AuthCard({ start = "in", notice }: { start?: "in" | "up"; notice?: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const checklistId = useId();
  const [mode, setMode] = useState<"in" | "up">(start);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [pending, setPending] = useState(false);
  /** The server rejected the email and password pair (sign-in only). */
  const [badCredentials, setBadCredentials] = useState(false);

  const signingUp = mode === "up";

  /** Update a field's value and clear the error shown on it. */
  function edit(field: Field, setter: (value: string) => void) {
    return (value: string) => {
      setter(value);
      setFormError("");
      if (field === "email" || field === "password") setBadCredentials(false);
      setFieldErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));
    };
  }

  function validate(trimmedEmail: string): FieldErrors {
    const errors: FieldErrors = {};
    if (signingUp && name.trim().length < 2) errors.name = "Enter your name (at least 2 characters).";
    if (!trimmedEmail) errors.email = "Enter your email address.";
    else if (!EMAIL_PATTERN.test(trimmedEmail)) errors.email = "Enter a valid email, like name@example.com.";
    if (!password) {
      errors.password = signingUp ? "Choose a password." : "Enter your password.";
    } else if (signingUp && passwordProblems(password).length > 0) {
      errors.password = "Your password does not meet all the requirements below.";
    }
    if (signingUp) {
      if (!confirm) errors.confirm = "Re-enter your password to confirm it.";
      else if (password !== confirm) errors.confirm = "Passwords do not match.";
    }
    return errors;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError("");
    setBadCredentials(false);
    const trimmedEmail = email.trim().toLowerCase();
    const errors = validate(trimmedEmail);
    setFieldErrors(errors);
    if (Object.values(errors).some(Boolean)) {
      // Move focus to the first field with a problem.
      const first = (["name", "email", "password", "confirm"] as const).find((field) => errors[field]);
      if (first) document.querySelector<HTMLInputElement>(`[name="${first === "confirm" ? "confirm-password" : first}"]`)?.focus();
      return;
    }
    setPending(true);
    try {
      const result = signingUp
        ? await signUp({ name: name.trim(), email: trimmedEmail, password })
        : await signIn({ email: trimmedEmail, password });
      if (!result.ok) {
        if (!signingUp && result.status === 401) {
          // Mark both fields, and explain under the password where the fix is.
          setBadCredentials(true);
          setFieldErrors({ password: "Incorrect email or password. Check them and try again." });
          document.querySelector<HTMLInputElement>('[name="password"]')?.focus();
        } else {
          setFormError(result.error);
        }
        return;
      }
      queryClient.setQueryData(ME_QUERY_KEY, result.user);
      await router.invalidate();
      await navigate({ to: "/" });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "That didn't work. Please try again.");
    } finally {
      setPending(false);
    }
  }

  /**
   * Switch between sign-in and sign-up. The email carries over (the user already
   * typed it); passwords never do, since a password that was just rejected, or
   * that is hidden behind dots, should not silently become a new account's password.
   */
  function switchMode() {
    const next = signingUp ? "in" : "up";
    setMode(next);
    setFieldErrors({});
    setFormError("");
    setBadCredentials(false);
    setPassword("");
    setConfirm("");
    // Put the cursor on the first empty field once the new form has rendered.
    window.setTimeout(() => {
      const target = next === "up" ? "name" : email ? "password" : "email";
      document.querySelector<HTMLInputElement>(`[name="${target}"]`)?.focus();
    }, 0);
  }

  const passwordsMatch = confirm.length > 0 && password === confirm;
  const passwordsDiffer = confirm.length > 0 && password !== confirm;

  return (
    <div className="w-full">
      <h1 className="text-3xl font-extrabold tracking-tight text-ink">
        {signingUp ? "Create your account" : "Welcome back"}
      </h1>
      <p className="mt-2 text-muted">
        {signingUp ? "Set up a manager account to run your queues." : "Sign in to manage your queues."}
      </p>
      {notice ? (
        <p
          className="mt-5 rounded-xl border border-success/30 bg-success-soft px-3.5 py-2.5 text-sm font-medium text-success"
          role="status"
        >
          {notice}
        </p>
      ) : null}

      <form className="mt-7 space-y-5" onSubmit={onSubmit} noValidate>
        {signingUp ? (
          <div>
            <label className="label" htmlFor="auth-name">
              Name
            </label>
            <input
              id="auth-name"
              name="name"
              className="field"
              value={name}
              onChange={(event) => edit("name", setName)(event.target.value)}
              autoComplete="name"
              maxLength={80}
              aria-invalid={fieldErrors.name ? true : undefined}
              aria-describedby={fieldErrors.name ? "auth-name-error" : undefined}
            />
            {fieldErrors.name ? (
              <p id="auth-name-error" className="mt-1.5 text-xs font-medium text-accent">
                {fieldErrors.name}
              </p>
            ) : null}
          </div>
        ) : null}

        <div>
          <label className="label" htmlFor="auth-email">
            Email address
          </label>
          <input
            id="auth-email"
            name="email"
            className="field"
            type="email"
            inputMode="email"
            value={email}
            onChange={(event) => edit("email", setEmail)(event.target.value)}
            autoComplete="email"
            placeholder="name@example.com"
            aria-invalid={fieldErrors.email || badCredentials ? true : undefined}
            aria-describedby={fieldErrors.email ? "auth-email-error" : undefined}
          />
          {fieldErrors.email ? (
            <p id="auth-email-error" className="mt-1.5 text-xs font-medium text-accent">
              {fieldErrors.email}
            </p>
          ) : null}
        </div>

        <div>
          <PasswordField
            label="Password"
            name="password"
            value={password}
            onChange={edit("password", setPassword)}
            autoComplete={signingUp ? "new-password" : "current-password"}
            error={fieldErrors.password}
            describedBy={signingUp ? checklistId : undefined}
          />
          {signingUp ? <PasswordChecklist id={checklistId} password={password} /> : null}
          {!signingUp ? (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              {badCredentials ? (
                <p className="text-xs text-muted">
                  No account yet?{" "}
                  <button type="button" className="font-semibold text-primary hover:underline" onClick={switchMode}>
                    Create one
                  </button>
                </p>
              ) : (
                <span />
              )}
              <Link to="/forgot-password" className="text-sm font-semibold text-primary hover:underline">
                Forgot password?
              </Link>
            </div>
          ) : null}
        </div>

        {signingUp ? (
          <div>
            <PasswordField
              label="Confirm password"
              name="confirm-password"
              value={confirm}
              onChange={edit("confirm", setConfirm)}
              autoComplete="new-password"
              error={fieldErrors.confirm}
            />
            {passwordsMatch ? (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-success" aria-live="polite">
                <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
                Passwords match.
              </p>
            ) : passwordsDiffer && !fieldErrors.confirm ? (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-accent" aria-live="polite">
                <X className="size-3.5" strokeWidth={3} aria-hidden="true" />
                Passwords do not match yet.
              </p>
            ) : null}
          </div>
        ) : null}

        {formError ? (
          <p className="rounded-xl bg-accent-soft px-3.5 py-2.5 text-sm font-medium text-accent" role="alert">
            {formError}
          </p>
        ) : null}

        <button className="btn btn-primary btn-lg w-full" type="submit" disabled={pending}>
          {pending ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : null}
          {pending ? "Please wait…" : signingUp ? "Create account" : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        {signingUp ? "Already have an account?" : "New here?"}{" "}
        <button type="button" className="font-semibold text-primary hover:underline" onClick={switchMode}>
          {signingUp ? "Sign in" : "Create an account"}
        </button>
      </p>
    </div>
  );
}
