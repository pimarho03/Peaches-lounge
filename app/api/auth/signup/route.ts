import { normalizeEmail, isEmailShaped } from "@/lib/auth/normalize";
import { validatePassword } from "@/lib/auth/password";
import {
  checkRateLimit,
  recordFailure,
  clearFailures,
} from "@/lib/auth/rate-limit";
import { clientIp } from "@/lib/auth/request";
import { assessRisk } from "@/lib/auth/risk";
import {
  createSession,
  getOrCreateDeviceId,
  homeFor,
} from "@/lib/auth/session";
import { createUser, findUserByEmail } from "@/lib/auth/store";

/**
 * Self-serve client registration. Same guards as login — invisible bot
 * check, rate limiting, backend normalization — and always creates a
 * `client` account (staff/admin are provisioned by an admin).
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = normalizeEmail(String(body.email ?? ""));
  const name = String(body.name ?? "").trim();
  const password = String(body.password ?? "");
  const remember = Boolean(body.remember);
  const ip = clientIp(req);

  const risk = assessRisk({ formToken: body.formToken, website: body.website });
  if (risk.suspicious) {
    await new Promise((r) => setTimeout(r, 1500));
    return Response.json(
      { ok: false, error: "Something went wrong. Please try again." },
      { status: 400 },
    );
  }

  // Rate-limit signups per email+IP too, so the form can't be hammered.
  const limit = checkRateLimit(email, ip);
  if (limit.locked) {
    return Response.json(
      { ok: false, error: "Too many attempts. Try again in a few minutes." },
      { status: 429 },
    );
  }

  if (!name) {
    return Response.json(
      { ok: false, field: "name", error: "Tell us what to call you." },
      { status: 400 },
    );
  }
  if (!isEmailShaped(email)) {
    return Response.json(
      { ok: false, field: "email", error: "That doesn't look like an email address yet." },
      { status: 400 },
    );
  }

  const check = validatePassword(password);
  if (!check.ok) {
    return Response.json(
      { ok: false, field: "password", error: check.error },
      { status: 400 },
    );
  }

  if (findUserByEmail(email)) {
    recordFailure(email, ip);
    // Specific, but doesn't confirm the account to a stranger beyond what the
    // login form already reveals — point them at signing in instead.
    return Response.json(
      {
        ok: false,
        field: "email",
        error: "An account already uses this email. Try signing in instead.",
      },
      { status: 409 },
    );
  }

  clearFailures(email, ip);
  const user = createUser({ email, name, password });
  const deviceId = await getOrCreateDeviceId();
  await createSession(user, { remember, deviceId });
  return Response.json({ ok: true, redirect: homeFor(user.role) });
}
