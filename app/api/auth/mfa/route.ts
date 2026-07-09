import { completePendingMfa, takePendingMfa } from "@/lib/auth/mfa";
import { createSession, homeFor } from "@/lib/auth/session";
import { findUserById } from "@/lib/auth/store";
import { verifyTotp } from "@/lib/auth/totp";

/** Second step for step-up logins: verify a TOTP code from an authenticator app. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const pendingToken = String(body.pendingToken ?? "");
  const code = String(body.code ?? "");

  const result = takePendingMfa(pendingToken);
  if (!result.ok) {
    const error =
      result.reason === "too-many-attempts"
        ? "Too many incorrect codes. Start the sign-in again."
        : "This sign-in attempt expired. Start again from the beginning.";
    return Response.json({ ok: false, error, restart: true }, { status: 401 });
  }

  const user = findUserById(result.pending.userId);
  if (!user?.totpSecret) {
    return Response.json(
      { ok: false, error: "This account has no authenticator set up.", restart: true },
      { status: 400 },
    );
  }

  if (!verifyTotp(user.totpSecret, code)) {
    return Response.json(
      {
        ok: false,
        error: "That code didn't match. Codes rotate every 30 seconds — check your app and try the current one.",
      },
      { status: 401 },
    );
  }

  completePendingMfa(pendingToken);
  await createSession(user, {
    remember: result.pending.remember,
    deviceId: result.pending.deviceId,
  });
  return Response.json({ ok: true, redirect: homeFor(user.role) });
}
