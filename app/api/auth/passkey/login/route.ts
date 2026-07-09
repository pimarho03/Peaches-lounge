import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";

import { rpFromRequest, storeChallenge, takeChallenge } from "@/lib/auth/passkeys";
import {
  createSession,
  getOrCreateDeviceId,
  homeFor,
} from "@/lib/auth/session";
import { db, type User } from "@/lib/auth/store";

/** Start a discoverable-credential (usernameless) passkey sign-in. */
export async function POST(req: Request) {
  const { rpID } = rpFromRequest(req);
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "preferred",
    allowCredentials: [],
  });
  const challengeKey = storeChallenge(options.challenge);
  return Response.json({ ok: true, options, challengeKey });
}

function findUserByCredentialId(credentialId: string): User | undefined {
  for (const user of db().users.values()) {
    if (user.passkeys.some((p) => p.id === credentialId)) return user;
  }
  return undefined;
}

export async function PUT(req: Request) {
  const body = await req.json().catch(() => ({}));
  const challenge = takeChallenge(String(body.challengeKey ?? ""));
  if (!challenge) {
    return Response.json(
      { ok: false, error: "Passkey sign-in timed out. Try again." },
      { status: 400 },
    );
  }

  const credentialId = String(body.response?.id ?? "");
  const user = findUserByCredentialId(credentialId);
  const passkey = user?.passkeys.find((p) => p.id === credentialId);
  if (!user || !passkey) {
    return Response.json(
      { ok: false, error: "That passkey isn't registered with any account here." },
      { status: 404 },
    );
  }

  const { rpID, origin } = rpFromRequest(req);
  try {
    const verification = await verifyAuthenticationResponse({
      response: body.response,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: passkey.id,
        publicKey: passkey.publicKey,
        counter: passkey.counter,
        transports: passkey.transports as never,
      },
    });
    if (!verification.verified) throw new Error("not verified");
    passkey.counter = verification.authenticationInfo.newCounter;
  } catch {
    return Response.json(
      { ok: false, error: "Couldn't verify that passkey. Try again." },
      { status: 401 },
    );
  }

  // A user-verified passkey is inherently two-factor (device possession +
  // biometric/PIN), so no additional TOTP step — even for staff/admin.
  const deviceId = await getOrCreateDeviceId();
  await createSession(user, { remember: true, deviceId });
  return Response.json({ ok: true, redirect: homeFor(user.role) });
}
