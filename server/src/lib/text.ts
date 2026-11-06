export function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Trim, collapse whitespace and cap the length. */
export function cleanText(value: unknown, max: number): string {
  return asString(value).trim().replace(/\s+/g, " ").slice(0, max);
}
