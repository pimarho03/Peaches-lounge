import "server-only";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";

import { db, findUserById, type Role, type Session, type User } from "./store";

export const SESSION_COOKIE = "pl_session";
export const DEVICE_COOKIE = "pl_device";

/** "Keep me logged in" → 30 days; otherwise a 12-hour working session. */
const REMEMBER_MS = 30 * 24 * 60 * 60_000;
const DEFAULT_MS = 12 * 60 * 60_000;

const isProd = process.env.NODE_ENV === "production";

/** Cryptographically random, httpOnly + Secure + SameSite — never a JWT in localStorage. */
export async function createSession(
  user: User,
  opts: { remember: boolean; deviceId: string },
): Promise<Session> {
  const token = randomBytes(32).toString("hex");
  const now = Date.now();
  const maxAgeMs = opts.remember ? REMEMBER_MS : DEFAULT_MS;
  const session: Session = {
    token,
    userId: user.id,
    role: user.role,
    createdAt: now,
    expiresAt: now + maxAgeMs,
    deviceId: opts.deviceId,
  };
  db().sessions.set(token, session);
  user.knownDevices.add(opts.deviceId);

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    // Omitting maxAge for non-remembered sessions makes the cookie
    // session-scoped: it dies with the browser.
    ...(opts.remember ? { maxAge: maxAgeMs / 1000 } : {}),
  });
  // Long-lived device marker so future logins can recognize this browser
  // (adaptive auth). Random id only — no fingerprinting.
  jar.set(DEVICE_COOKIE, opts.deviceId, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 365 * 24 * 60 * 60,
  });
  return session;
}

export async function getSession(): Promise<
  { session: Session; user: User } | null
> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = db().sessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    db().sessions.delete(token);
    return null;
  }
  const user = findUserById(session.userId);
  if (!user) return null;
  return { session, user };
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) db().sessions.delete(token);
  jar.delete(SESSION_COOKIE);
}

/** Where each role lands after login — one URL in, role-routed out. */
export function homeFor(role: Role): string {
  switch (role) {
    case "admin":
      return "/admin";
    case "staff":
      return "/staff";
    default:
      return "/dashboard";
  }
}

export async function getOrCreateDeviceId(): Promise<string> {
  const jar = await cookies();
  return jar.get(DEVICE_COOKIE)?.value ?? randomBytes(16).toString("hex");
}
