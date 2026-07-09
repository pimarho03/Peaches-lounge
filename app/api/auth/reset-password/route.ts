import { validatePassword } from "@/lib/auth/password";
import { clearFailures } from "@/lib/auth/rate-limit";
import { clientIp } from "@/lib/auth/request";
import {
  createPendingMfa,
  requiresMfa,
} from "@/lib/auth/mfa";
import {
  createSession,
  getOrCreateDeviceId,
  homeFor,
} from "@/lib/auth/session";
import { findUserById, setPassword } from "@/lib/auth/store";
import { consumeMagicLink, peekLink } from "@/lib/auth/tokens";

/** Confirm a reset token is still valid so the form can render (or not). */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const valid = peekLink(token, "reset") !== null;
  return Response.json({ ok: valid });
}

/** Set a new password from a reset link, then sign in (MFA still applies). */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const tokenValue = String(body.token ?? "");
  const password = String(body.password ?? "");

  const check = validatePassword(password);
  if (!check.ok) {
    return Response.json({ ok: false, error: check.error }, { status: 400 });
  }

  const token = consumeMagicLink(tokenValue);
  if (!token || token.purpose !== "reset") {
    return Response.json(
      {
        ok: false,
        error: "This reset link expired or was already used. Request a fresh one.",
        restart: true,
      },
      { status: 400 },
    );
  }

  const user = findUserById(token.userId);
  if (!user) {
    return Response.json(
      { ok: false, error: "This reset link is no longer valid.", restart: true },
      { status: 400 },
    );
  }

  setPassword(user, password);
  // A fresh password clears any active lockout for this account.
  clearFailures(user.email, clientIp(req));

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
