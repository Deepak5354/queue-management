import type { ErrorComponentProps } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";

const FALLBACK_MESSAGE = "An unexpected error occurred. Try reloading the page.";

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return FALLBACK_MESSAGE;
}

export function AppErrorComponent({ error }: ErrorComponentProps) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-paper px-6 text-center text-ink">
      <span className="grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent" aria-hidden="true">
        <TriangleAlert className="size-7" strokeWidth={2} />
      </span>
      <h1 className="text-2xl font-extrabold">Something went wrong</h1>
      <p className="max-w-md text-sm break-words text-muted">{errorMessage(error)}</p>
      <button type="button" className="btn btn-primary mt-2" onClick={() => window.location.reload()}>
        Reload page
      </button>
    </main>
  );
}
