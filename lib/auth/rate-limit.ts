import "server-only";

import { db } from "./store";

const WINDOW_MS = 60_000;
export const MAX_FAILURES_PER_MINUTE = 5;
export const LOCKOUT_MS = 15 * 60_000;

export type RateLimitState =
  | { locked: false; remaining: number }
  | { locked: true; unlockAt: number };

function key(email: string, ip: string) {
  return `${email}|${ip}`;
}

/** Check the lockout/velocity state for an email+IP pair before verifying. */
export function checkRateLimit(email: string, ip: string): RateLimitState {
  const k = key(email, ip);
  const now = Date.now();

  const unlockAt = db().lockouts.get(k);
  if (unlockAt !== undefined) {
    if (now < unlockAt) return { locked: true, unlockAt };
    db().lockouts.delete(k);
    db().failedAttempts.delete(k);
  }

  const recent = (db().failedAttempts.get(k) ?? []).filter(
    (t) => now - t < WINDOW_MS,
  );
  db().failedAttempts.set(k, recent);
  return { locked: false, remaining: MAX_FAILURES_PER_MINUTE - recent.length };
}

/** Record a failed attempt; returns the new state (may flip to locked). */
export function recordFailure(email: string, ip: string): RateLimitState {
  const k = key(email, ip);
  const now = Date.now();
  const recent = (db().failedAttempts.get(k) ?? []).filter(
    (t) => now - t < WINDOW_MS,
  );
  recent.push(now);
  db().failedAttempts.set(k, recent);

  if (recent.length >= MAX_FAILURES_PER_MINUTE) {
    const unlockAt = now + LOCKOUT_MS;
    db().lockouts.set(k, unlockAt);
    return { locked: true, unlockAt };
  }
  return { locked: false, remaining: MAX_FAILURES_PER_MINUTE - recent.length };
}

export function clearFailures(email: string, ip: string) {
  const k = key(email, ip);
  db().failedAttempts.delete(k);
  db().lockouts.delete(k);
}
