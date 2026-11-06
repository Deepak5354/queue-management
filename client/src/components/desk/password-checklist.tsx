import { Check } from "lucide-react";
import { clsx } from "clsx";
import { passwordRules } from "@/lib/auth/password-rules";

/** Live list of password requirements. Each turns green as it is met. */
export function PasswordChecklist({ password, id }: { password: string; id?: string }) {
  const rules = passwordRules(password);
  return (
    <ul id={id} aria-label="Password requirements" className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5">
      {rules.map((rule) => (
        <li
          key={rule.id}
          className={clsx(
            "flex items-center gap-1.5 text-xs font-medium transition-colors",
            rule.ok ? "text-success" : "text-muted",
          )}
        >
          <span
            aria-hidden="true"
            className={clsx(
              "grid size-4 place-items-center rounded-full transition-colors",
              rule.ok ? "bg-emerald-500 text-white" : "border border-slate-300 bg-sheet",
            )}
          >
            {rule.ok ? <Check className="size-3" strokeWidth={3} /> : null}
          </span>
          {rule.label}
          <span className="sr-only">{rule.ok ? " (met)" : " (not met yet)"}</span>
        </li>
      ))}
    </ul>
  );
}
