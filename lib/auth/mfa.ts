import "server-only";

import { randomBytes } from "node:crypto";

import { db, type PendingMfa, type User } from "./store";

const PENDING_TTL_MS = 5 * 60_000;
const MAX_MFA_ATTEMPTS = 5;

/**
 * Adaptive auth: decide whether this login owes a second factor.
 * - Staff and admin ALWAYS step up — no configuration needed.
 * - Clients step up only when risk is elevated (unrecognized device) and
 *   they have an enrolled factor; otherwise standard auth.
 */
export function requiresMfa(user: User, deviceId: string): boolean {
  if (user.role === "staff" || user.role === "admin") return true;
  const newDevice = !user.knownDevices.has(deviceId);
  return newDevice && user.totpSecret !== null;
}

export function createPendingMfa(
  user: User,
  opts: { remember: boolean; deviceId: string },
): PendingMfa {
  const pending: PendingMfa = {
    token: randomBytes(32).toString("hex"),
    userId: user.id,
    remember: opts.remember,
    deviceId: opts.deviceId,
    expiresAt: Date.now() + PENDING_TTL_MS,
    attempts: 0,
  };
  db().pendingMfa.set(pending.token, pending);
  return pending;
}

export type PendingMfaResult =
  | { ok: true; pending: PendingMfa }
  | { ok: false; reason: "expired" | "too-many-attempts" };

/** Look up and tick the attempt counter on a pending MFA login. */
export function takePendingMfa(token: string): PendingMfaResult {
  const pending = db().pendingMfa.get(token);
  if (!pending || Date.now() > pending.expiresAt) {
    if (pending) db().pendingMfa.delete(token);
    return { ok: false, reason: "expired" };
  }
  pending.attempts += 1;
  if (pending.attempts > MAX_MFA_ATTEMPTS) {
    db().pendingMfa.delete(token);
    return { ok: false, reason: "too-many-attempts" };
  }
  return { ok: true, pending };
}

export function completePendingMfa(token: string) {
  db().pendingMfa.delete(token);
}
