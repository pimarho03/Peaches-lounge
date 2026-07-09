import { isEmailShaped, normalizeEmail } from "@/lib/auth/normalize";
import { issueFormToken } from "@/lib/auth/risk";
import { findUserByEmail } from "@/lib/auth/store";

/**
 * Identity-first routing: the client sends just the identifier and learns
 * which auth methods to reveal (password, passkey). Clients, staff, and
 * admin all pass through here — role is never exposed; auth strength is
 * applied automatically at the password/MFA steps.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = normalizeEmail(String(body.email ?? ""));

  if (!isEmailShaped(email)) {
    return Response.json(
      { ok: false, error: "That doesn't look like an email address yet." },
      { status: 400 },
    );
  }

  const user = findUserByEmail(email);
  if (!user) {
    return Response.json(
      {
        ok: false,
        error:
          "No account found with this email. Check the spelling, or sign up first.",
      },
      { status: 404 },
    );
  }

  return Response.json({
    ok: true,
    email,
    methods: {
      password: true,
      passkey: user.passkeys.length > 0,
      magicLink: true,
      otp: true,
    },
  });
}

/** The login form fetches a signed timing token on mount (invisible risk check). */
export async function GET() {
  return Response.json({ formToken: issueFormToken() });
}
