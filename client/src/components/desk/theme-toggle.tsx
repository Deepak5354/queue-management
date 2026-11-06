import { Moon, Sun } from "lucide-react";
import { clsx } from "clsx";

/**
 * Switches between light and dark. The choice is saved in localStorage; with no
 * saved choice the page follows the system setting (see `public/theme-init.js`).
 * `labeled` shows the words "Dark mode" / "Light mode" next to the icon so the
 * control is easy to find.
 */
export function ThemeToggle({ labeled = false, className }: { labeled?: boolean; className?: string }) {
  function toggle() {
    const root = document.documentElement;
    const dark = !root.classList.contains("dark");
    root.classList.toggle("dark", dark);
    try {
      localStorage.setItem("theme", dark ? "dark" : "light");
    } catch {
      /* Storage blocked: the choice just will not be remembered. */
    }
  }
  return (
    <button
      type="button"
      onClick={toggle}
      className={clsx(
        className ??
          (labeled
            ? "inline-flex min-h-9 items-center gap-2 rounded-full border border-line bg-sheet px-3.5 text-sm font-medium text-muted shadow-sm transition-colors hover:text-ink"
            : "grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-hover hover:text-ink"),
      )}
      aria-label="Toggle dark mode"
      title="Toggle dark mode"
    >
      <Moon className="theme-moon size-[1.1rem] shrink-0" aria-hidden="true" />
      <Sun className="theme-sun size-[1.1rem] shrink-0" aria-hidden="true" />
      {labeled ? (
        <>
          <span className="theme-label-light">Dark mode</span>
          <span className="theme-label-dark">Light mode</span>
        </>
      ) : null}
    </button>
  );
}
