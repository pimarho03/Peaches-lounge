import "server-only";

import { randomBytes, randomInt } from "node:crypto";

import { db, type OneTimeToken, type User } from "./store";

const MAGIC_LINK_TTL_MS = 15 * 60_000;
const OTP_TTL_MS = 10 * 60_000;
const MAX_OTP_ATTEMPTS = 5;

/** Single-use magic-link token (also used for post-lockout reset links). */
export function issueMagicLink(
  user: User,
  purpose: "magic-link" | "reset" = "magic-link",
): OneTimeToken {
  const token: OneTimeToken = {
    token: randomBytes(32).toString("hex"),
    userId: user.id,
    purpose,
    expiresAt: Date.now() + MAGIC_LINK_TTL_MS,
    attempts: 0,
  };
  db().oneTimeTokens.set(token.token, token);
  return token;
}

/** Single-use 6-digit email OTP, guarded by an opaque request token. */
export function issueOtp(user: User): OneTimeToken {
  const token: OneTimeToken = {
    token: randomBytes(32).toString("hex"),
    userId: user.id,
    purpose: "otp",
    code: randomInt(0, 1_000_000).toString().padStart(6, "0"),
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
  };
  db().oneTimeTokens.set(token.token, token);
  return token;
}

export function consumeMagicLink(tokenValue: string): OneTimeToken | null {
  const token = db().oneTimeTokens.get(tokenValue);
  if (!token || token.purpose === "otp") return null;
  db().oneTimeTokens.delete(tokenValue); // single use, success or not
  if (Date.now() > token.expiresAt) return null;
  return token;
}

/**
 * Validate a link token without consuming it — used to hand a reset token
 * off to the set-new-password form, which consumes it on submit.
 */
export function peekLink(
  tokenValue: string,
  purpose: OneTimeToken["purpose"],
): OneTimeToken | null {
  const token = db().oneTimeTokens.get(tokenValue);
  if (!token || token.purpose !== purpose) return null;
  if (Date.now() > token.expiresAt) {
    db().oneTimeTokens.delete(tokenValue);
    return null;
  }
  return token;
}

export type OtpOutcome =
  | { result: "ok"; userId: string }
  | { result: "wrong-code" | "expired" | "too-many-attempts" };

export function consumeOtp(tokenValue: string, code: string): OtpOutcome {
  const token = db().oneTimeTokens.get(tokenValue);
  if (!token || token.purpose !== "otp") return { result: "expired" };
  if (Date.now() > token.expiresAt) {
    db().oneTimeTokens.delete(tokenValue);
    return { result: "expired" };
  }
  token.attempts += 1;
  if (token.attempts > MAX_OTP_ATTEMPTS) {
    db().oneTimeTokens.delete(tokenValue);
    return { result: "too-many-attempts" };
  }
  if (token.code !== code.replace(/\s+/g, "")) return { result: "wrong-code" };
  db().oneTimeTokens.delete(tokenValue);
  return { result: "ok", userId: token.userId };
}

/**
 * Demo mail transport: logs the message to the server console. Replace with
 * a provider (Resend/Postmark/SES) — the call sites won't change.
 */
export function deliver(email: string, subject: string, body: string) {
  console.log(`\n📧 [to: ${email}] ${subject}\n${body}\n`);
}
