# Login UX & Security Checklist

Audit of the booking app's sign-in system against the product checklist.
Every item lists where it's implemented so regressions are greppable.

Demo accounts (in-memory store, `lib/auth/store.ts`):

| Account | Password | Role | MFA |
| --- | --- | --- | --- |
| `client@peacheslounge.com` | `matcha-and-mats` | client | none (standard auth) |
| `staff@peacheslounge.com` | `reformer-rows-9` | staff | TOTP, always |
| `admin@peacheslounge.com` | `deep-black-11111` | admin | TOTP, always |

Staff/admin TOTP secrets are fixed demo values in `store.ts` — add them to any
authenticator app to test. Emails (magic links, OTP codes) print to the server
console; in dev the link/code is also surfaced in the UI.

## UX problems eliminated

| Item | Status | Where |
| --- | --- | --- |
| Rage clicks — spinner + disabled buttons on every submit; in-flight guard blocks duplicate requests | ✅ | `app/login/page.tsx` (`busy` state on every handler) |
| Validation while typing — errors fire on blur only; typing can only *clear* an error | ✅ | `app/login/page.tsx` email `onBlur`/`onChange` |
| Disappearing placeholders — labels sit above every field; helper text below; no placeholder-as-label | ✅ | `app/login/page.tsx` (Label + helper `<p>`) |
| Password visibility toggle — eye icon inside the field, `aria-pressed` | ✅ | `app/login/page.tsx` password step |
| Vague error messages — specific per failure: "No account found with this email…", "Incorrect password for this account…", per-cause OTP/TOTP messages | ✅ | `app/api/auth/*/route.ts` |
| Aggressive CAPTCHAs — none; invisible honeypot + signed form-timing token; Turnstile/reCAPTCHA v3 slot documented | ✅ | `lib/auth/risk.ts` |
| Strict input rejection — emails trimmed/lowercased, phones normalized server-side | ✅ | `lib/auth/normalize.ts`, used by every route |
| Cluttered layout — wordmark + card only; no nav, banners, or marketing | ✅ | `app/login/layout.tsx`, `app/login/page.tsx` |

## Features every modern login should have

| Item | Status | Where |
| --- | --- | --- |
| Identity-first routing — email first, then methods revealed per account | ✅ | `app/api/auth/identify/route.ts`, step machine in `app/login/page.tsx` |
| SSO buttons — Google / Apple / Microsoft, primary placement | ✅ | `app/login/page.tsx`; routes in `app/api/auth/sso/[provider]/route.ts` (redirects to provider once `GOOGLE_CLIENT_ID` etc. are set; honest notice until then) |
| Passkey / WebAuthn — FaceID / TouchID / Windows Hello via SimpleWebAuthn; enrollment from any signed-in page | ✅ | `app/api/auth/passkey/*`, `components/account-panel.tsx` |
| Magic link / OTP fallback — 15-min single-use link and 10-min 6-digit email code | ✅ | `app/api/auth/magic-link/route.ts`, `app/api/auth/otp/route.ts` |
| On-blur validation only | ✅ | `app/login/page.tsx` |
| Show password toggle | ✅ | `app/login/page.tsx` |
| Mobile keyboard types — `type="email"`/`inputMode="email"`; `inputMode="numeric"` + `autocomplete="one-time-code"` for codes; autocorrect/autocapitalize off on password | ✅ | `app/login/page.tsx` |
| Single-column layout — stacked fields, labels above, helper text below | ✅ | `app/login/page.tsx` |
| "Keep me logged in" — 30-day persistent session vs 12-hour default; browser-session cookie otherwise | ✅ | checkbox in `app/login/page.tsx`; `lib/auth/session.ts` |
| Identity-first routing for roles — one URL, server routes client→/dashboard, staff→/staff, admin→/admin | ✅ | `homeFor()` in `lib/auth/session.ts`; guards in `lib/auth/guard.ts` |

## Backend & security

| Item | Status | Where |
| --- | --- | --- |
| Rate limiting + lockout — 5 failures/min per email+IP → 15-min lock; one-time sign-in link emailed immediately | ✅ | `lib/auth/rate-limit.ts`; lockout response in `app/api/auth/login/route.ts` |
| bcrypt hashing — bcryptjs cost 10, unique salt per password | ✅ | `lib/auth/store.ts`, compare in `app/api/auth/login/route.ts` |
| Adaptive auth — device cookie; unrecognized device triggers silent step-up for enrolled users | ✅ | `requiresMfa()` in `lib/auth/mfa.ts`; device cookie in `lib/auth/session.ts` |
| MFA/2FA — TOTP (RFC 6238, authenticator apps), no SMS anywhere; passkeys count as inherent 2FA | ✅ | `lib/auth/totp.ts`, `app/api/auth/mfa/route.ts` |
| Secure session tokens — 256-bit random, `httpOnly` + `Secure` (prod) + `SameSite=Lax`; server-side revocation on logout | ✅ | `lib/auth/session.ts` |

## Peaches Lounge specific

| Item | Status | Where |
| --- | --- | --- |
| Single login URL — `/login` for clients, staff, admin; role never asked for | ✅ | `app/login/page.tsx`, `proxy.ts` gate |
| App UI — black & white liquid glass on deep `#111111`; no peachy tones in-app | ✅ | `app/login/layout.tsx` (forced dark, `#111111` gradient), glass card design system |
| Role-based MFA strength — clients standard; staff/admin always step up, zero configuration | ✅ | `requiresMfa()` in `lib/auth/mfa.ts` |

## Before production

The auth *flows* are complete; these swaps are needed for launch:

- **Persistence** — replace the in-memory `globalThis` store (`lib/auth/store.ts`) with a real database; the map shapes mirror the tables to create.
- **Email delivery** — replace `deliver()` in `lib/auth/tokens.ts` (console logger) with Resend/Postmark/SES.
- **SSO credentials** — set `GOOGLE_CLIENT_ID` / `APPLE_CLIENT_ID` / `MICROSOFT_CLIENT_ID` and implement the `/callback` token exchange per provider.
- **Risk scoring** — optionally add Cloudflare Turnstile / reCAPTCHA v3 validation inside `assessRisk()` (`lib/auth/risk.ts`).
- **TOTP enrollment UI** — secrets are seeded for demo staff/admin; production needs a QR-code enrollment screen and encrypted secret storage.
