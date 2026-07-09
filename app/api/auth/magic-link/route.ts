import { createPendingMfa, requiresMfa } from "@/lib/auth/mfa";
import { normalizeEmail } from "@/lib/auth/normalize";
import {
  createSession,
  getOrCreateDeviceId,
  homeFor,
} from "@/lib/auth/session";
import { findUserByEmail, findUserById } from "@/lib/auth/store";
import {
  consumeMagicLink,
  deliver,
  issueMagicLink,
  peekLink,
} from "@/lib/auth/tokens";

/** Request a magic sign-in link — the password-forgotten escape hatch. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = normalizeEmail(String(body.email ?? ""));
  const origin = new URL(req.url).origin;

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

  const token = issueMagicLink(user);
  const link = `${origin}/api/auth/magic-link?token=${token.token}`;
  deliver(
    email,
    "Peaches Lounge — your sign-in link",
    `Tap to sign in (valid 15 minutes, single use): ${link}`,
  );

  return Response.json({
    ok: true,
    message: `Sign-in link sent to ${email}. It's valid for 15 minutes.`,
    // Dev convenience only: without a mail provider the "email" goes to the
    // server console; surface it in non-production so the flow is testable.
    ...(process.env.NODE_ENV !== "production" ? { devLink: link } : {}),
  });
}

/** The link target: consume the token, then session or MFA step-up. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const tokenValue = url.searchParams.get("token") ?? "";

  // Reset links (issued on lockout) go to the set-new-password form instead
  // of logging straight in — peek so the reset endpoint can consume it.
  if (peekLink(tokenValue, "reset")) {
    return Response.redirect(
      new URL(`/login?reset=${tokenValue}`, url.origin),
      303,
    );
  }

  const token = consumeMagicLink(tokenValue);
  if (!token) {
    return Response.redirect(
      new URL("/login?error=link-expired", url.origin),
      303,
    );
  }

  const user = findUserById(token.userId);
  if (!user) {
    return Response.redirect(
      new URL("/login?error=link-expired", url.origin),
      303,
    );
  }

  const deviceId = await getOrCreateDeviceId();
  // Email control is one factor; staff/admin still owe their second one.
  if (requiresMfa(user, deviceId)) {
    const pending = createPendingMfa(user, { remember: false, deviceId });
    return Response.redirect(
      new URL(`/login?mfa=${pending.token}`, url.origin),
      303,
    );
  }

  await createSession(user, { remember: false, deviceId });
  return Response.redirect(new URL(homeFor(user.role), url.origin), 303);
}
