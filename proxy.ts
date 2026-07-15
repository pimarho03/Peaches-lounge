import { NextResponse, type NextRequest } from "next/server";

/**
 * Launch gate: the iOS app is the real booking product (TestFlight later);
 * this site ships today as brand-only marketing. Auth/booking code stays
 * intact (untouched) so it can be re-enabled at launch — this just blocks
 * public access to it in the meantime.
 *
 * Controlled by NEXT_PUBLIC_APP_SURFACES: "on" re-enables the app surfaces
 * (local dev), anything else (including unset, the production default)
 * keeps them gated.
 */
const APP_SURFACES_ON = process.env.NEXT_PUBLIC_APP_SURFACES === "on";

const GATED_PAGE_PREFIXES = ["/login", "/signup", "/dashboard", "/staff", "/admin"];
const GATED_API_PREFIXES = ["/api/auth", "/api/bookings", "/api/classes"];
// Subset that also gets the session-cookie bounce-to-/login when app
// surfaces are on — unchanged from the original protected-page behavior.
const SESSION_CHECKED_PREFIXES = ["/dashboard", "/staff", "/admin"];

function isUnderAnyPrefix(pathname: string, prefixes: string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/**
 * Edge gate for protected areas. Proxy can't reach the session store, so it
 * only checks for the session cookie's presence and bounces obviously
 * signed-out visitors to /login (preserving where they were headed).
 * Real session validation + role enforcement happen server-side in
 * `requireRole` on each protected page.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!APP_SURFACES_ON) {
    if (isUnderAnyPrefix(pathname, GATED_API_PREFIXES)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (isUnderAnyPrefix(pathname, GATED_PAGE_PREFIXES)) {
      // 308: permanent-feeling but fully reversible once app surfaces flip on.
      return NextResponse.redirect(new URL("/", request.url), 308);
    }
  }

  // With app surfaces on (or for paths the gate above doesn't cover, e.g.
  // /login, /signup, and the /api/* routes), preserve original behavior:
  // only /dashboard, /staff, /admin get the session-cookie bounce here.
  // API routes and /login|/signup handle their own auth server-side.
  if (isUnderAnyPrefix(pathname, SESSION_CHECKED_PREFIXES)) {
    const hasSession = request.cookies.has("pl_session");
    if (!hasSession) {
      const login = new URL("/login", request.url);
      login.searchParams.set("next", request.nextUrl.pathname);
      return NextResponse.redirect(login);
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/login/:path*",
    "/signup/:path*",
    "/dashboard/:path*",
    "/staff/:path*",
    "/admin/:path*",
    "/api/auth/:path*",
    "/api/bookings/:path*",
    "/api/classes/:path*",
  ],
};
