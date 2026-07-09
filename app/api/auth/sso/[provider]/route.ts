/**
 * SSO entry point — one route per provider, e.g. /api/auth/sso/google.
 * When a provider's OAuth credentials are configured, this redirects to its
 * consent screen; until then it bounces back to /login with an honest notice
 * instead of a dead button.
 */

const PROVIDERS = {
  google: {
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    clientIdEnv: "GOOGLE_CLIENT_ID",
    scope: "openid email profile",
  },
  apple: {
    authUrl: "https://appleid.apple.com/auth/authorize",
    clientIdEnv: "APPLE_CLIENT_ID",
    scope: "name email",
  },
  microsoft: {
    authUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    clientIdEnv: "MICROSOFT_CLIENT_ID",
    scope: "openid email profile",
  },
} as const;

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

  const url = new URL(config.authUrl);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", `${origin}/api/auth/sso/${provider}/callback`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", config.scope);
  return Response.redirect(url, 303);
}
