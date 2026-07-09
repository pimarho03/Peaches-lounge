import QRCode from "qrcode";

import { db } from "@/lib/auth/store";
import { getSession } from "@/lib/auth/session";
import { generateTotpSecret, totpUri, verifyTotp } from "@/lib/auth/totp";

/**
 * Authenticator (TOTP) enrollment for a signed-in user. Clients can opt in;
 * staff/admin already had a demo secret seeded, but this lets them rotate to
 * their own. The pending secret lives on the session's device marker until a
 * valid code confirms the user actually scanned it.
 */
const globalForEnroll = globalThis as unknown as {
  __peachesPendingTotp?: Map<string, { secret: string; expiresAt: number }>;
};

function pending() {
  globalForEnroll.__peachesPendingTotp ??= new Map();
  return globalForEnroll.__peachesPendingTotp;
}

/** Step 1: mint a secret, return the QR (data URL) + otpauth URI to scan. */
export async function POST() {
  const auth = await getSession();
  if (!auth) return Response.json({ ok: false }, { status: 401 });

  const secret = generateTotpSecret();
  pending().set(auth.user.id, { secret, expiresAt: Date.now() + 10 * 60_000 });

  const uri = totpUri(secret, auth.user.email);
  const qr = await QRCode.toDataURL(uri, { margin: 1, width: 240 });
  return Response.json({ ok: true, secret, uri, qr });
}

/** Step 2: confirm a code from the app, then persist the secret. */
export async function PUT(req: Request) {
  const auth = await getSession();
  if (!auth) return Response.json({ ok: false }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const code = String(body.code ?? "");

  const entry = pending().get(auth.user.id);
  if (!entry || Date.now() > entry.expiresAt) {
    pending().delete(auth.user.id);
    return Response.json(
      { ok: false, error: "Enrollment timed out. Start again.", restart: true },
      { status: 400 },
    );
  }

  if (!verifyTotp(entry.secret, code)) {
    return Response.json(
      { ok: false, error: "That code didn't match. Codes rotate every 30 seconds." },
      { status: 401 },
    );
  }

  const user = db().users.get(auth.user.email);
  if (user) user.totpSecret = entry.secret;
  pending().delete(auth.user.id);
  return Response.json({ ok: true });
}
