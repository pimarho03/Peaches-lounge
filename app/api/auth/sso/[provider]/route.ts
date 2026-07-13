/**
 * SSO entry point — one route per provider, e.g. /api/auth/sso/google.
 * When a provider's OAuth credentials are configured, this redirects to its
 * consent screen; until then it bounces back to /login with an honest notice
 * instead of a dead button.
 *
 * Security: every authorize request mints a fresh `state` (CSRF defence) and a
 * PKCE verifier (S256). Both are stashed in a short-lived, httpOnly `pl_oauth`
 * cookie so the callback can prove the round-trip belongs to this browser. The
 * verifier never leaves the server except as its S256 hash on the wire.
 */

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

export const OAUTH_COOKIE = "pl_oauth";
/** Ten minutes is plenty to complete a consent screen; short by design. */
const OAUTH_COOKIE_MAX_AGE = 10 * 60;

const isProd = process.env.NODE_ENV === "production";

const PROVIDERS = {
  google: {
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    clientIdEnv: "GOOGLE_CLIENT_ID",
    scope: "openid email profile",
    /** Google-specific consent tuning: no refresh token, always pick account. */
    extraParams: {
      access_type: "online",
      prompt: "select_account",
    } as Record<string, string>,
  },
  apple: {
    authUrl: "https://appleid.apple.com/auth/authorize",
    clientIdEnv: "APPLE_CLIENT_ID",
    scope: "name email",
    extraParams: {} as Record<string, string>,
  },
  microsoft: {
    authUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    clientIdEnv: "MICROSOFT_CLIENT_ID",
    scope: "openid email profile",
    extraParams: {} as Record<string, string>,
  },
} as const;

/** base64url with no padding — the encoding PKCE (RFC 7636) requires. */
function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const origin = new URL(req.url).origin;
  const config = PROVIDERS[provider as keyof typeof PROVIDERS];

  if (!config) {
    return Response.redirect(new URL("/login?error=unknown-sso", origin), 303);
  }

  const clientId = process.env[config.clientIdEnv];
  if (!clientId) {
    return Response.redirect(
      new URL(`/login?notice=sso-not-configured&provider=${provider}`, origin),
      303,
    );
  }

  // CSRF state + PKCE verifier/challenge. The verifier stays server-side
  // (in the httpOnly cookie); only its S256 hash travels to the provider.
  const state = randomBytes(32).toString("hex");
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash("sha256").update(verifier).digest());

  const jar = await cookies();
  jar.set(OAUTH_COOKIE, JSON.stringify({ state, verifier, provider }), {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: OAUTH_COOKIE_MAX_AGE,
  });

  const url = new URL(config.authUrl);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", `${origin}/api/auth/sso/${provider}/callback`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", config.scope);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  for (const [k, v] of Object.entries(config.extraParams)) {
    url.searchParams.set(k, v);
  }
  return Response.redirect(url, 303);
}
