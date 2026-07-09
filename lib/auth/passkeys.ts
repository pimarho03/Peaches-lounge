import "server-only";

import { randomBytes } from "node:crypto";

import { db } from "./store";

const CHALLENGE_TTL_MS = 5 * 60_000;

/**
 * WebAuthn relying-party identity, derived from the request so dev
 * (localhost) and prod (peacheslounge.com) both work without config.
 */
export function rpFromRequest(req: Request): {
  rpID: string;
  origin: string;
  rpName: string;
} {
  const url = new URL(req.url);
  const origin = req.headers.get("origin") ?? url.origin;
  return { rpID: new URL(origin).hostname, origin, rpName: "Peaches Lounge" };
}

/** Store a one-shot WebAuthn challenge keyed by an opaque handle. */
export function storeChallenge(challenge: string): string {
  const key = randomBytes(16).toString("hex");
  db().passkeyChallenges.set(key, {
    challenge,
    expiresAt: Date.now() + CHALLENGE_TTL_MS,
  });
  return key;
}

export function takeChallenge(key: string): string | null {
  const entry = db().passkeyChallenges.get(key);
  db().passkeyChallenges.delete(key);
  if (!entry || Date.now() > entry.expiresAt) return null;
  return entry.challenge;
}
