import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";

import { rpFromRequest, storeChallenge, takeChallenge } from "@/lib/auth/passkeys";
import { getSession } from "@/lib/auth/session";

/**
 * Passkey enrollment (WebAuthn). Registration happens while signed in;
 * afterwards the account can sign in with FaceID / TouchID / Windows Hello.
 */
export async function POST(req: Request) {
  const auth = await getSession();
  if (!auth) return Response.json({ ok: false }, { status: 401 });

  const { rpID, rpName } = rpFromRequest(req);
  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: auth.user.email,
    userDisplayName: auth.user.name,
    attestationType: "none",
    excludeCredentials: auth.user.passkeys.map((p) => ({
      id: p.id,
      transports: p.transports as never,
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });
  const challengeKey = storeChallenge(options.challenge);
  return Response.json({ ok: true, options, challengeKey });
}

export async function PUT(req: Request) {
  const auth = await getSession();
  if (!auth) return Response.json({ ok: false }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const challenge = takeChallenge(String(body.challengeKey ?? ""));
  if (!challenge) {
    return Response.json(
      { ok: false, error: "Passkey setup timed out. Try again." },
      { status: 400 },
    );
  }

  const { rpID, origin } = rpFromRequest(req);
  try {
    const verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });
    if (!verification.verified || !verification.registrationInfo) {
      throw new Error("not verified");
    }
    const { credential } = verification.registrationInfo;
    auth.user.passkeys.push({
      id: credential.id,
      publicKey: credential.publicKey,
      counter: credential.counter,
      transports: credential.transports,
    });
    return Response.json({ ok: true });
  } catch {
    return Response.json(
      { ok: false, error: "Couldn't verify that passkey. Try again." },
      { status: 400 },
    );
  }
}
