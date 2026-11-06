export function formatToken(code: string, number: number) {
  return `${code}-${String(number).padStart(3, "0")}`;
}

export function formatMinutes(sec: number | null) {
  if (sec == null || !Number.isFinite(sec)) return "—";
  const safe = Math.max(0, sec);
  if (safe < 60) return `${Math.max(1, Math.round(safe))}s`;
  const minutes = safe / 60;
  if (minutes < 10) return `${minutes.toFixed(1)} min`;
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

export function formatClock(fromIso: string, now: number) {
  const start = new Date(fromIso).getTime();
  if (Number.isNaN(start)) return "—";
  const total = Math.max(0, Math.floor((now - start) / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  if (minutes < 60) return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export function suggestCode(name: string) {
  const words = name
    .trim()
    .split(/\s+/)
    .map((word) => word.replace(/[^A-Za-z0-9]/g, ""))
    .filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words
    .map((word) => word[0])
    .join("")
    .slice(0, 4)
    .toUpperCase();
}

/** A queue code not in `taken`, based on `base` (for example A, then A2, A3). */
export function nextCode(taken: Set<string>, base: string) {
  const clean = base.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4) || "Q";
  if (!taken.has(clean)) return clean;
  for (let n = 2; n < 100; n += 1) {
    const suffix = String(n);
    const code = (clean.slice(0, Math.max(1, 4 - suffix.length)) + suffix).slice(0, 4);
    if (!taken.has(code)) return code;
  }
  return `Q${taken.size % 100}`.slice(0, 4);
}
