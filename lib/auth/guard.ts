import "server-only";

import { redirect } from "next/navigation";

import { getSession } from "./session";
import type { Role, User } from "./store";

/**
 * Server-side page guard: validates the session against the store and
 * enforces role. Everyone signs in at the same URL; where they may go is
 * decided here, not by which login form they used.
 */
export async function requireRole(...allowed: Role[]): Promise<User> {
  const auth = await getSession();
  if (!auth) redirect("/login");
  if (!allowed.includes(auth.user.role)) {
    // Signed in but wrong area — send them to their own home, not an error.
    const home =
      auth.user.role === "admin"
        ? "/admin"
        : auth.user.role === "staff"
          ? "/staff"
          : "/dashboard";
    redirect(home);
  }
  return auth.user;
}
