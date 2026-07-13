/**
 * OAuth callback — the return leg of /api/auth/sso/[provider].
 *
 * Only Google is wired end-to-end today. The authorize step will happily start
 * the dance for apple/microsoft if someone sets their client-id env var, so we
 * fail those here with an honest "not supported yet" rather than crashing.
 *
 * Security posture:
 * - `state` from the query must equal the value in the httpOnly `pl_oauth`
 *   cookie (CSRF / session-fixation defence). Missing or mismatched → refuse.
 * - PKCE: the code is exchanged with the stored `code_verifier`.
 * - Identity comes from Google's userinfo endpoint (no local JWT verification),
 *   and we require `email_verified === true` before linking/creating an
 *   account — otherwise a spoofed unverified email could hijack an existing
 *   account by matching its address.
 * - Tokens are never logged and never leave this handler.
 */

import { cookies } from "next/headers";

import { requiresMfa } from "@/lib/auth/mfa";
import { normalizeEmail } from "@/lib/auth/normalize";
import {
  createSession,
  getOrCreateDeviceId,
  homeFor,
} from "@/lib/auth/session";
import { createSsoUser, findUserByEmail } from "@/lib/auth/store";
import { OAUTH_COOKIE } from "../route";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
/** Cap outbound calls so a hung provider can't wedge the request. */
const FETCH_TIMEOUT_MS = 8_000;

function redirect(origin: string, path: string): Response {
  return Response.redirect(new URL(path, origin), 303);
}

/** Best-effort JSON fetch with a hard timeout. Returns null on any failure. */
async function fetchJson(
  url: string,
  init: RequestInit,
): Promise<Record<string, unknown> | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const url = new URL(req.url);
  const origin = url.origin;
  const jar = await cookies();

  // Always clear the one-shot oauth cookie on the way out, whatever happens.
  const clearOauthCookie = () => jar.delete(OAUTH_COOKIE);

  // The provider hands back its own error when the user declines or something
  // goes wrong on their side. A cancel is not an error tone — nudge, don't scold.
  const providerError = url.searchParams.get("error");
  if (providerError) {
    clearOauthCookie();
    const gentle = providerError === "access_denied";
    return redirect(
      origin,
      gentle ? "/login?notice=sso-cancelled" : "/login?error=sso-failed",
    );
  }

  // Validate the round-trip against the cookie before trusting any input.
  const raw = jar.get(OAUTH_COOKIE)?.value;
  clearOauthCookie();
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");

  let stored: { state?: string; verifier?: string; provider?: string } = {};
  try {
    stored = raw ? JSON.parse(raw) : {};
  } catch {
    stored = {};
  }

  if (
    !raw ||
    !state ||
    !code ||
    !stored.state ||
    !stored.verifier ||
    stored.state !== state ||
    stored.provider !== provider
  ) {
    return redirect(origin, "/login?error=sso-failed");
  }

  // Authorize will start the flow for any provider whose client-id is set, but
  // only Google has a working callback. Refuse the rest clearly.
  if (provider !== "google") {
    return redirect(origin, "/login?error=sso-unsupported");
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return redirect(origin, "/login?error=sso-failed");
  }

  // Exchange the code (with the PKCE verifier) for tokens.
  const tokenBody = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: `${origin}/api/auth/sso/${provider}/callback`,
    code_verifier: stored.verifier,
  });
  const token = await fetchJson(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenBody.toString(),
  });
  const accessToken =
    token && typeof token.access_token === "string" ? token.access_token : null;
  if (!accessToken) {
    return redirect(origin, "/login?error=sso-failed");
  }

  // Identity via userinfo — avoids verifying an id_token signature locally.
  const profile = await fetchJson(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!profile) {
    return redirect(origin, "/login?error=sso-failed");
  }

  const emailRaw = typeof profile.email === "string" ? profile.email : "";
  // Google returns email_verified as a boolean; some clients see a string.
  const emailVerified =
    profile.email_verified === true || profile.email_verified === "true";
  if (!emailRaw || !emailVerified) {
    // Refuse to link/create off an unverified address — account-takeover guard.
    return redirect(origin, "/login?error=sso-unverified");
  }

  const email = normalizeEmail(emailRaw);
  const name =
    (typeof profile.name === "string" && profile.name.trim()) ||
    email.split("@")[0];

  // Account linking by verified email: an existing account (however it was
  // created) is signed in; otherwise we provision a fresh client account.
  const user = findUserByEmail(email) ?? createSsoUser({ email, name });

  const deviceId = await getOrCreateDeviceId();

  // Adaptive MFA still applies to SSO. Staff/admin (and clients with a factor
  // on a new device) owe a second factor — but the MFA challenge is a
  // fetch/JSON flow on the login page, not a redirect flow we can drive from
  // here. Pragmatic v1: instead of silently bypassing the step-up, we send
  // them to finish with email + authenticator. Clients with no factor proceed
  // straight to a session.
  if (requiresMfa(user, deviceId)) {
    return redirect(origin, "/login?notice=sso-mfa-required");
  }

  // SSO sessions default to a standard (non-remembered) working session.
  await createSession(user, { remember: false, deviceId });
  return redirect(origin, homeFor(user.role));
}
