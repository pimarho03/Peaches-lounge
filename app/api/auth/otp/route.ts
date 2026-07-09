import { createPendingMfa, requiresMfa } from "@/lib/auth/mfa";
import { normalizeEmail } from "@/lib/auth/normalize";
import {
  createSession,
  getOrCreateDeviceId,
  homeFor,
} from "@/lib/auth/session";
import { findUserByEmail, findUserById } from "@/lib/auth/store";
import { consumeOtp, deliver, issueOtp } from "@/lib/auth/tokens";

/** Request a 6-digit one-time email code (magic link's copy-paste sibling). */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = normalizeEmail(String(body.email ?? ""));

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

  const token = issueOtp(user);
  deliver(
    email,
    "Peaches Lounge — your one-time code",
    `Your sign-in code is ${token.code} (valid 10 minutes).`,
  );

  return Response.json({
    ok: true,
    otpToken: token.token,
    message: `Code sent to ${email}. It's valid for 10 minutes.`,
    ...(process.env.NODE_ENV !== "production" ? { devCode: token.code } : {}),
  });
}

/** Verify the emailed code, then session or MFA step-up. */
export async function PUT(req: Request) {
  const body = await req.json().catch(() => ({}));
  const otpToken = String(body.otpToken ?? "");
  const code = String(body.code ?? "");

  const outcome = consumeOtp(otpToken, code);
  if (outcome.result !== "ok") {
    const errors = {
      "wrong-code": "That code didn't match. Check the most recent email — only the newest code works.",
      expired: "That code expired. Request a fresh one below.",
      "too-many-attempts": "Too many incorrect codes. Request a fresh one below.",
    } as const;
    return Response.json(
      {
        ok: false,
        error: errors[outcome.result],
        restart: outcome.result !== "wrong-code",
      },
      { status: 401 },
    );
  }

  const user = findUserById(outcome.userId);
  if (!user) {
    return Response.json(
      { ok: false, error: "That code expired. Request a fresh one below.", restart: true },
      { status: 401 },
    );
  }

  const deviceId = await getOrCreateDeviceId();
  if (requiresMfa(user, deviceId)) {
    const pending = createPendingMfa(user, { remember: false, deviceId });
    return Response.json({
      ok: true,
      mfaRequired: true,
      pendingToken: pending.token,
      method: "totp",
    });
  }

  await createSession(user, { remember: false, deviceId });
  return Response.json({ ok: true, redirect: homeFor(user.role) });
}
