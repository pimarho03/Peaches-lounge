import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge gate for protected areas. Proxy can't reach the session store, so it
 * only checks for the session cookie's presence and bounces obviously
 * signed-out visitors to /login (preserving where they were headed).
 * Real session validation + role enforcement happen server-side in
 * `requireRole` on each protected page.
 */
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has("pl_session");
  if (!hasSession) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/staff/:path*", "/admin/:path*"],
};
