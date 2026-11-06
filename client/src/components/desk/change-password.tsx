import { useId, useState, type FormEvent } from "react";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { changePassword } from "@/lib/auth/client";
import { passwordProblems } from "@/lib/auth/password-rules";
import { PasswordChecklist } from "@/components/desk/password-checklist";
import { PasswordField } from "@/components/desk/password-field";

type Field = "current" | "next" | "confirm";
type FieldErrors = Partial<Record<Field, string>>;

/** Change the signed-in manager's password. Needs the current password. */
export function ChangePasswordCard() {
  const checklistId = useId();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [pending, setPending] = useState(false);

  function edit(field: Field, setter: (value: string) => void) {
    return (value: string) => {
      setter(value);
      setFormError("");
      setErrors((existing) => (existing[field] ? { ...existing, [field]: undefined } : existing));
    };
  }

  function validate(): FieldErrors {
    const found: FieldErrors = {};
    if (!current) found.current = "Enter your current password.";
    if (!next) found.next = "Choose a new password.";
    else if (passwordProblems(next).length > 0) found.next = "Your new password does not meet all the requirements below.";
    else if (next === current) found.next = "Choose a password that is different from the current one.";
    if (!confirm) found.confirm = "Re-enter the new password.";
    else if (next !== confirm) found.confirm = "Passwords do not match.";
    return found;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError("");
    const found = validate();
    setErrors(found);
    if (Object.values(found).some(Boolean)) {
      const first = (["current", "next", "confirm"] as const).find((field) => found[field]);
      const name = first === "current" ? "current-password" : first === "next" ? "new-password" : "confirm-new-password";
      document.querySelector<HTMLInputElement>(`[name="${name}"]`)?.focus();
      return;
    }
    setPending(true);
    try {
      const result = await changePassword(current, next);
      if (!result.ok) {
        if (/current password/i.test(result.error)) setErrors({ current: result.error });
        else setFormError(result.error);
        return;
      }
      toast.success("Password changed. Other devices were signed out.");
      setCurrent("");
      setNext("");
      setConfirm("");
      setErrors({});
    } finally {
      setPending(false);
    }
  }

  const matches = confirm.length > 0 && next === confirm;
  const differs = confirm.length > 0 && next !== confirm;

  return (
    <section className="panel p-6" aria-labelledby="change-password-heading">
      <h2 id="change-password-heading" className="text-lg font-bold">
        Change password
      </h2>
      <p className="mt-1 text-sm text-muted">You will stay signed in here. Other devices will be signed out.</p>
      <form className="mt-5 space-y-5" onSubmit={onSubmit} noValidate>
        <PasswordField
          label="Current password"
          name="current-password"
          value={current}
          onChange={edit("current", setCurrent)}
          autoComplete="current-password"
          error={errors.current}
        />
        <div>
          <PasswordField
            label="New password"
            name="new-password"
            value={next}
            onChange={edit("next", setNext)}
            autoComplete="new-password"
            error={errors.next}
            describedBy={checklistId}
          />
          <PasswordChecklist id={checklistId} password={next} />
        </div>
        <div>
          <PasswordField
            label="Confirm new password"
            name="confirm-new-password"
            value={confirm}
            onChange={edit("confirm", setConfirm)}
            autoComplete="new-password"
            error={errors.confirm}
          />
          {matches ? (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-success" aria-live="polite">
              <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
              Passwords match.
            </p>
          ) : differs && !errors.confirm ? (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-accent" aria-live="polite">
              <X className="size-3.5" strokeWidth={3} aria-hidden="true" />
              Passwords do not match yet.
            </p>
          ) : null}
        </div>
        {formError ? (
          <p className="rounded-xl bg-accent-soft px-3.5 py-2.5 text-sm font-medium text-accent" role="alert">
            {formError}
          </p>
        ) : null}
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          {pending ? "Saving…" : "Update password"}
        </button>
      </form>
    </section>
  );
}
