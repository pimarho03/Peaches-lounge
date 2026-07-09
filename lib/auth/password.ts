/**
 * Password policy, shared by signup and reset. Deliberately length-first
 * (NIST 800-63B): a long passphrase beats a short one full of symbols, and
 * we don't punish the user with arbitrary character-class rules.
 */

export const MIN_PASSWORD_LENGTH = 10;

/** A small block-list of the most-guessed passwords, checked case-folded. */
const COMMON = new Set([
  "password",
  "password1",
  "12345678",
  "123456789",
  "1234567890",
  "qwertyuiop",
  "letmein123",
  "iloveyou12",
  "adminadmin",
]);

export type PasswordCheck = { ok: true } | { ok: false; error: string };

export function validatePassword(raw: string): PasswordCheck {
  const password = raw.normalize("NFKC");
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      error: `Use at least ${MIN_PASSWORD_LENGTH} characters — a short phrase like "matcha at sunrise" works well.`,
    };
  }
  if (COMMON.has(password.toLowerCase())) {
    return {
      ok: false,
      error: "That password is too common. Pick something only you would know.",
    };
  }
  if (/^(.)\1+$/.test(password)) {
    return { ok: false, error: "That password is too simple. Mix it up a little." };
  }
  return { ok: true };
}
