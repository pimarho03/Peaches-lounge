import bcrypt from "bcryptjs";

import { createPendingMfa, requiresMfa } from "@/lib/auth/mfa";
import { normalizeEmail } from "@/lib/auth/normalize";
import {
  checkRateLimit,
  clearFailures,
  recordFailure,
} from "@/lib/auth/rate-limit";
import { clientIp } from "@/lib/auth/request";
import { assessRisk } from "@/lib/auth/risk";
import {
  createSession,
  getOrCreateDeviceId,
  homeFor,
} from "@/lib/auth/session";
import { findUserByEmail } from "@/lib/auth/store";
import { deliver, issueMagicLink } from "@/lib/auth/tokens";

function lockoutResponse(email: string, unlockAt: number, origin: string) {
  // Offer the way out immediately: a reset/one-time login link, no waiting.
  const user = findUserByEmail(email);
  if (user) {
    const reset = issueMagicLink(user, "reset");
    deliver(
      email,
      "Peaches Lounge — unlock your account",
      `Too many sign-in attempts. Use this link to sign in and reset: ${origin}/api/auth/magic-link?token=${reset.token}`,
    );
  }
  const minutes = Math.max(1, Math.ceil((unlockAt - Date.now()) / 60_000));
  return Response.json(
    {
      ok: false,
      locked: true,
      error: `Too many attempts — this account is locked for ${minutes} minute${minutes === 1 ? "" : "s"}. We've emailed you a one-time sign-in link so you don't have to wait.`,
    },
    { status: 423 },
  );
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = normalizeEmail(String(body.email ?? ""));
  const password = String(body.password ?? "");
  const remember = Boolean(body.remember);
  const ip = clientIp(req);
  const origin = new URL(req.url).origin;

  // Invisible bot check — honeypot + signed timing token. Suspicious
  // requests get a slow, generic failure instead of a puzzle.
  const risk = assessRisk({ formToken: body.formToken, website: body.website });
  if (risk.suspicious) {
    await new Promise((r) => setTimeout(r, 1500));
    return Response.json(
      { ok: false, error: "Something went wrong. Please try again." },
      { status: 400 },
    );
  }

  const limit = checkRateLimit(email, ip);
  if (limit.locked) return lockoutResponse(email, limit.unlockAt, origin);

  const user = findUserByEmail(email);
  if (!user) {
    return Response.json(
      {
        ok: false,
        error:
          "No account found with this email. Check the spelling, or sign up first.",
      },
      { status: 404 },
    );
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    const after = recordFailure(email, ip);
    if (after.locked) return lockoutResponse(email, after.unlockAt, origin);
    return Response.json(
      {
        ok: false,
        error:
          "Incorrect password for this account. Try again, or use a one-time email link instead.",
        remaining: after.remaining,
      },
      { status: 401 },
    );
  }

  clearFailures(email, ip);
  const deviceId = await getOrCreateDeviceId();

  // Adaptive + role-based step-up: staff/admin always, clients on new
  // devices when they have an enrolled factor.
  if (requiresMfa(user, deviceId)) {
    const pending = createPendingMfa(user, { remember, deviceId });
    return Response.json({
      ok: true,
      mfaRequired: true,
      pendingToken: pending.token,
      method: "totp",
    });
  }

  await createSession(user, { remember, deviceId });
  return Response.json({ ok: true, redirect: homeFor(user.role) });
}
