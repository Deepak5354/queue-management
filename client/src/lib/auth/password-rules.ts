export type PasswordRule = { id: string; label: string; ok: boolean };

/** The password requirements, each with whether the given password meets it. */
export function passwordRules(password: string): PasswordRule[] {
  return [
    { id: "length", label: "At least 8 characters", ok: password.length >= 8 },
    { id: "letter", label: "One letter", ok: /[A-Za-z]/.test(password) },
    { id: "number", label: "One number", ok: /[0-9]/.test(password) },
  ];
}

export function passwordProblems(password: string): string[] {
  const problems: string[] = [];
  if (password.length < 8) problems.push("Use at least 8 characters.");
  if (password.length > 128) problems.push("Use at most 128 characters.");
  if (!/[A-Za-z]/.test(password)) problems.push("Include a letter.");
  if (!/[0-9]/.test(password)) problems.push("Include a number.");
  return problems;
}
