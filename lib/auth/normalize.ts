/**
 * Input normalization — the backend forgives, it never punishes.
 * "User@Email.com ", "user@email.com" and a phone typed with dashes or
 * spaces must all resolve to the same account.
 */

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Strip spaces, dashes, dots and parens; keep a leading +. */
export function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  const plus = trimmed.startsWith("+") ? "+" : "";
  return plus + trimmed.replace(/[^0-9]/g, "");
}

export function isEmailShaped(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
