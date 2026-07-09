import "server-only";

import { createHmac, randomBytes } from "node:crypto";

/**
 * Invisible risk checks — no image puzzles, ever. A honeypot field plus a
 * signed form-timing token catch dumb bots silently; humans never see any
 * of it. For stronger scoring, drop in Cloudflare Turnstile or reCAPTCHA v3
 * here (validate their token server-side in `assessRisk`).
 */

const globalForRisk = globalThis as unknown as { __peachesRiskKey?: Buffer };

function signingKey(): Buffer {
  globalForRisk.__peachesRiskKey ??= randomBytes(32);
  return globalForRisk.__peachesRiskKey;
}

/** Issued when the login form loads; proves how long the human took. */
export function issueFormToken(): string {
  const issuedAt = Date.now().toString();
  const sig = createHmac("sha256", signingKey()).update(issuedAt).digest("hex");
  return `${issuedAt}.${sig}`;
}

const MIN_HUMAN_MS = 1_200;
const MAX_TOKEN_AGE_MS = 60 * 60_000;

export type RiskInput = {
  formToken: string | undefined;
  /** Honeypot field — must be empty. Bots autofill it. */
  website: string | undefined;
};

export function assessRisk(input: RiskInput): { suspicious: boolean } {
  if (input.website) return { suspicious: true };

  if (!input.formToken) return { suspicious: true };
  const [issuedAt, sig] = input.formToken.split(".");
  const expected = createHmac("sha256", signingKey())
    .update(issuedAt ?? "")
    .digest("hex");
  if (sig !== expected) return { suspicious: true };

  const elapsed = Date.now() - Number(issuedAt);
  if (elapsed < MIN_HUMAN_MS || elapsed > MAX_TOKEN_AGE_MS) {
    return { suspicious: true };
  }
  return { suspicious: false };
}
