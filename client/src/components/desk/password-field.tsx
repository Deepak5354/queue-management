import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  name,
  error,
  describedBy,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  name: string;
  /** Message shown under the field; also marks it invalid. */
  error?: string;
  /** Id of extra help text (such as a checklist) to announce with the field. */
  describedBy?: string;
}) {
  const [visible, setVisible] = useState(false);
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className="block">
      <label htmlFor={id} className="label">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          className="field pr-11"
          name={name}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          maxLength={128}
          aria-invalid={error ? true : undefined}
          aria-describedby={[error ? errorId : null, describedBy].filter(Boolean).join(" ") || undefined}
        />
        <button
          type="button"
          className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-ink"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={visible}
        >
          {visible ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
        </button>
      </div>
      {error ? (
        <p id={errorId} className="mt-1.5 text-xs font-medium text-accent">
          {error}
        </p>
      ) : null}
    </div>
  );
}
