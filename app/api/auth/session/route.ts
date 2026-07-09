import { destroySession, getSession } from "@/lib/auth/session";

/** Who am I? Used by protected pages and the login page's redirect check. */
export async function GET() {
  const auth = await getSession();
  if (!auth) return Response.json({ ok: false }, { status: 401 });
  const { user } = auth;
  return Response.json({
    ok: true,
    user: {
      name: user.name,
      email: user.email,
      role: user.role,
      passkeys: user.passkeys.length,
      mfaEnrolled: user.totpSecret !== null,
    },
  });
}

export async function DELETE() {
  await destroySession();
  return Response.json({ ok: true });
}
