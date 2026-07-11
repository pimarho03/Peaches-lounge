"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { startAuthentication } from "@simplewebauthn/browser";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  AppleLogo,
  ArrowLeft,
  CircleNotch,
  Envelope,
  Eye,
  EyeSlash,
  Fingerprint,
  GoogleLogo,
  WindowsLogo,
} from "@phosphor-icons/react";

import { BackButton } from "@/components/back-button";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/glass-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Single sign-in URL for clients, staff, and admin. Identity-first: ask for
 * the email, then reveal only the methods that account actually has. Auth
 * strength (MFA step-up) is decided server-side by role and device — the
 * form never needs to know who's who.
 */

type Step =
  | { name: "identify" }
  | { name: "password"; email: string; passkey: boolean }
  | { name: "mfa"; pendingToken: string }
  | { name: "email-code"; email: string; otpToken: string; devCode?: string }
  | { name: "link-sent"; email: string; devLink?: string }
  | { name: "reset"; token: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 10;

function Spinner() {
  return <CircleNotch className="size-4 animate-spin" weight="bold" />;
}

/** Inline field error — rendered only after blur, never mid-keystroke. */
function FieldError({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="text-danger text-sm">
      {children}
    </p>
  );
}

function FormError({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <div
      role="alert"
      className="bg-danger/10 text-danger rounded-2xl px-4 py-3 text-sm"
    >
      {children}
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <div className="bg-secondary text-secondary-foreground rounded-2xl px-4 py-3 text-sm">
      {children}
    </div>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();

  const [step, setStep] = useState<Step>(() => {
    // Reset links land here to set a new password.
    const reset = params.get("reset");
    if (reset) return { name: "reset", token: reset };
    // Magic-link logins for staff/admin land back here for their second factor.
    const mfa = params.get("mfa");
    return mfa ? { name: "mfa", pendingToken: mfa } : { name: "identify" };
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [code, setCode] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const notice =
    params.get("error") === "link-expired"
      ? "That sign-in link expired or was already used. Request a fresh one below."
      : params.get("notice") === "sso-not-configured"
        ? `Sign-in with ${params.get("provider") ?? "that provider"} isn't connected yet — use your email below.`
        : null;

  // Signed form-timing token for the invisible bot check.
  const formTokenRef = useRef<string>("");
  useEffect(() => {
    fetch("/api/auth/identify")
      .then((r) => r.json())
      .then((d) => {
        formTokenRef.current = d.formToken ?? "";
      })
      .catch(() => {});
  }, []);

  // Already signed in? Skip the form entirely — unless they're here to set a
  // new password from a reset link, which should always let them finish.
  useEffect(() => {
    if (params.get("reset")) return;
    fetch("/api/auth/session").then((r) => {
      if (r.ok) router.replace(params.get("next") ?? "/dashboard");
    });
  }, [router, params]);

  const honeypotRef = useRef<HTMLInputElement>(null);

  // Step transitions: a critically-damped spring (Apple's default for
  // non-momentum UI — bounce 0, ~0.3s response), degrading to a plain
  // cross-fade under prefers-reduced-motion. Motion animates from the live
  // presentation value, so a fast stepper stays interruptible instead of
  // jumping. (apple-design §4, §7, §14)
  const prefersReduced = useReducedMotion();
  const stepVariants = prefersReduced
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, y: 8, scale: 0.99 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: -8, scale: 0.99 },
      };
  const stepTransition = prefersReduced
    ? { duration: 0.15 }
    : ({ type: "spring", bounce: 0, duration: 0.32 } as const);

  async function post(url: string, body: unknown, method = "POST") {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { res, data: await res.json().catch(() => ({})) };
  }

  function finish(redirect: string | undefined) {
    const next = params.get("next");
    router.replace(next && next.startsWith("/") ? next : (redirect ?? "/dashboard"));
  }

  /** Step 1 → 2: identify the account and reveal its methods. */
  async function handleIdentify(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return; // no duplicate requests on rage clicks
    if (!EMAIL_RE.test(email.trim())) {
      setEmailError("Enter your email address, like you@example.com.");
      return;
    }
    setBusy("identify");
    setError(null);
    try {
      const { data } = await post("/api/auth/identify", { email });
      if (!data.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      setStep({
        name: "password",
        email: data.email,
        passkey: Boolean(data.methods?.passkey),
      });
    } catch {
      setError("We couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy("password");
    setError(null);
    try {
      const { data } = await post("/api/auth/login", {
        email,
        password,
        remember,
        formToken: formTokenRef.current,
        website: honeypotRef.current?.value ?? "",
      });
      if (!data.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      if (data.mfaRequired) {
        setCode("");
        setStep({ name: "mfa", pendingToken: data.pendingToken });
        return;
      }
      finish(data.redirect);
    } catch {
      setError("We couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  async function handleMfa(e: React.FormEvent) {
    e.preventDefault();
    if (busy || step.name !== "mfa") return;
    setBusy("mfa");
    setError(null);
    try {
      const { data } = await post("/api/auth/mfa", {
        pendingToken: step.pendingToken,
        code,
      });
      if (!data.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        if (data.restart) setStep({ name: "identify" });
        return;
      }
      finish(data.redirect);
    } catch {
      setError("We couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  async function handlePasskey() {
    if (busy) return;
    setBusy("passkey");
    setError(null);
    try {
      const { data } = await post("/api/auth/passkey/login", {});
      if (!data.ok) throw new Error();
      const response = await startAuthentication({ optionsJSON: data.options });
      const { data: verified } = await post(
        "/api/auth/passkey/login",
        { challengeKey: data.challengeKey, response },
        "PUT",
      );
      if (!verified.ok) {
        setError(verified.error ?? "Passkey sign-in didn't work. Try another method.");
        return;
      }
      finish(verified.redirect);
    } catch (err) {
      // User closing the browser prompt is a cancel, not an error.
      if (err instanceof Error && err.name === "NotAllowedError") return;
      setError("Passkey sign-in didn't work here. Try your password instead.");
    } finally {
      setBusy(null);
    }
  }

  async function handleMagicLink() {
    if (busy) return;
    setBusy("magic");
    setError(null);
    try {
      const { data } = await post("/api/auth/magic-link", { email });
      if (!data.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      setStep({ name: "link-sent", email, devLink: data.devLink });
    } finally {
      setBusy(null);
    }
  }

  async function handleOtpRequest() {
    if (busy) return;
    setBusy("otp-request");
    setError(null);
    try {
      const { data } = await post("/api/auth/otp", { email });
      if (!data.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      setCode("");
      setStep({ name: "email-code", email, otpToken: data.otpToken, devCode: data.devCode });
    } finally {
      setBusy(null);
    }
  }

  async function handleOtpVerify(e: React.FormEvent) {
    e.preventDefault();
    if (busy || step.name !== "email-code") return;
    setBusy("otp");
    setError(null);
    try {
      const { data } = await post(
        "/api/auth/otp",
        { otpToken: step.otpToken, code },
        "PUT",
      );
      if (!data.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        if (data.restart) setStep({ name: "password", email, passkey: false });
        return;
      }
      if (data.mfaRequired) {
        setCode("");
        setStep({ name: "mfa", pendingToken: data.pendingToken });
        return;
      }
      finish(data.redirect);
    } finally {
      setBusy(null);
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (busy || step.name !== "reset") return;
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters for your new password.`);
      return;
    }
    setBusy("reset");
    setError(null);
    try {
      const { data } = await post("/api/auth/reset-password", {
        token: step.token,
        password: newPassword,
      });
      if (!data.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        if (data.restart) setStep({ name: "identify" });
        return;
      }
      if (data.mfaRequired) {
        setCode("");
        setNewPassword("");
        setStep({ name: "mfa", pendingToken: data.pendingToken });
        return;
      }
      setNewPassword("");
      finish(data.redirect);
    } catch {
      setError("We couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  const backToStart = (
    <button
      type="button"
      onClick={() => {
        setStep({ name: "identify" });
        setError(null);
        setPassword("");
        setCode("");
      }}
      className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm transition-colors"
    >
      <ArrowLeft className="size-3.5" weight="bold" />
      Use a different email
    </button>
  );

  return (
    <GlassCard className="flex w-full flex-col gap-6 rounded-3xl p-8">
      {/* Honeypot — invisible to humans, irresistible to bots. */}
      <input
        ref={honeypotRef}
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute -left-[9999px] size-px opacity-0"
      />

      <Notice>{notice}</Notice>
      <FormError>{error}</FormError>

      {/* One step is mounted at a time; keying by step.name lets Motion
          cross-fade + spring between them (apple-design §3 interruptibility). */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step.name}
          variants={stepVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={stepTransition}
          className="flex flex-col gap-6"
        >
      {step.name === "identify" && (
        <>
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
            <p className="text-muted-foreground text-sm">
              One door for everyone — members, instructors, and admins.
            </p>
          </div>

          {/* SSO first-class, not an afterthought. Full navigations — the
              provider redirect must leave the SPA. */}
          <div className="flex flex-col gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full gap-2"
              onClick={() => window.location.assign("/api/auth/sso/google")}
            >
              <GoogleLogo className="size-4.5" weight="bold" />
              Continue with Google
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full gap-2"
              onClick={() => window.location.assign("/api/auth/sso/apple")}
            >
              <AppleLogo className="size-4.5" weight="fill" />
              Continue with Apple
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full gap-2"
              onClick={() => window.location.assign("/api/auth/sso/microsoft")}
            >
              <WindowsLogo className="size-4.5" weight="regular" />
              Continue with Microsoft
            </Button>
          </div>

          <Button
            type="button"
            variant="secondary"
            size="lg"
            className="w-full gap-2"
            onClick={handlePasskey}
            disabled={busy !== null}
          >
            {busy === "passkey" ? <Spinner /> : <Fingerprint className="size-4.5" weight="regular" />}
            Sign in with a passkey
          </Button>

          <div className="text-muted-foreground flex items-center gap-3 text-xs uppercase tracking-wider">
            <span className="border-border flex-1 border-t" />
            or with email
            <span className="border-border flex-1 border-t" />
          </div>

          <form onSubmit={handleIdentify} noValidate className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email webauthn"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoFocus
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  // Only clear an existing error while typing — never add one.
                  if (emailError && EMAIL_RE.test(e.target.value.trim())) {
                    setEmailError(null);
                  }
                }}
                onBlur={() => {
                  if (email && !EMAIL_RE.test(email.trim())) {
                    setEmailError("Enter your email address, like you@example.com.");
                  }
                }}
                aria-invalid={emailError ? true : undefined}
                aria-describedby={emailError ? "email-error" : undefined}
                className="h-11 rounded-2xl px-4"
              />
              <span id="email-error">
                <FieldError>{emailError}</FieldError>
              </span>
            </div>
            <Button type="submit" size="lg" className="w-full gap-2" disabled={busy !== null}>
              {busy === "identify" && <Spinner />}
              Continue
            </Button>
          </form>

          <p className="text-muted-foreground text-center text-sm">
            New to Peaches Lounge?{" "}
            <a
              href="/signup"
              className="text-foreground font-medium underline underline-offset-2"
            >
              Create an account
            </a>
          </p>
        </>
      )}

      {step.name === "reset" && (
        <>
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">Set a new password</h1>
            <p className="text-muted-foreground text-sm">
              Choose a new password to finish signing in.
            </p>
          </div>
          <form onSubmit={handleReset} noValidate className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-password">New password</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  name="new-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  autoFocus
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="h-11 rounded-2xl px-4 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex w-11 items-center justify-center transition-colors"
                >
                  {showPassword ? (
                    <EyeSlash className="size-5" weight="regular" />
                  ) : (
                    <Eye className="size-5" weight="regular" />
                  )}
                </button>
              </div>
              <p className="text-muted-foreground text-sm">
                At least {MIN_PASSWORD_LENGTH} characters — a short phrase works well.
              </p>
            </div>
            <Button
              type="submit"
              size="lg"
              className="w-full gap-2"
              disabled={busy !== null || newPassword.length < MIN_PASSWORD_LENGTH}
            >
              {busy === "reset" && <Spinner />}
              Set password &amp; sign in
            </Button>
          </form>
        </>
      )}

      {step.name === "password" && (
        <>
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
            <p className="text-muted-foreground text-sm">
              Signing in as <span className="text-foreground font-medium">{email}</span>
            </p>
          </div>

          {step.passkey && (
            <Button
              type="button"
              variant="secondary"
              size="lg"
              className="w-full gap-2"
              onClick={handlePasskey}
              disabled={busy !== null}
            >
              {busy === "passkey" ? <Spinner /> : <Fingerprint className="size-4.5" weight="regular" />}
              Use your passkey
            </Button>
          )}

          <form onSubmit={handlePassword} noValidate className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  autoFocus
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 rounded-2xl px-4 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex w-11 items-center justify-center transition-colors"
                >
                  {showPassword ? (
                    <EyeSlash className="size-5" weight="regular" />
                  ) : (
                    <Eye className="size-5" weight="regular" />
                  )}
                </button>
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="accent-foreground size-4 rounded"
              />
              Keep me signed in on this device
            </label>

            <Button type="submit" size="lg" className="w-full gap-2" disabled={busy !== null}>
              {busy === "password" && <Spinner />}
              Sign in
            </Button>
          </form>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleMagicLink}
              disabled={busy !== null}
              className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm transition-colors disabled:opacity-50"
            >
              {busy === "magic" ? <Spinner /> : <Envelope className="size-3.5" weight="regular" />}
              Forgot your password? Email me a sign-in link
            </button>
            <button
              type="button"
              onClick={handleOtpRequest}
              disabled={busy !== null}
              className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm transition-colors disabled:opacity-50"
            >
              {busy === "otp-request" ? <Spinner /> : <Envelope className="size-3.5" weight="regular" />}
              Email me a one-time code instead
            </button>
            {backToStart}
          </div>
        </>
      )}

      {step.name === "mfa" && (
        <>
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">One more step</h1>
            <p className="text-muted-foreground text-sm">
              Enter the 6-digit code from your authenticator app.
            </p>
          </div>
          <form onSubmit={handleMfa} noValidate className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="totp">Authenticator code</Label>
              <Input
                id="totp"
                name="totp"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                autoComplete="one-time-code"
                autoFocus
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="h-11 rounded-2xl px-4 text-center font-mono text-lg tracking-[0.4em]"
              />
              <p className="text-muted-foreground text-sm">
                Codes rotate every 30 seconds.
              </p>
            </div>
            <Button
              type="submit"
              size="lg"
              className="w-full gap-2"
              disabled={busy !== null || code.length < 6}
            >
              {busy === "mfa" && <Spinner />}
              Verify
            </Button>
          </form>
          {backToStart}
        </>
      )}

      {step.name === "email-code" && (
        <>
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">Check your email</h1>
            <p className="text-muted-foreground text-sm">
              We sent a 6-digit code to{" "}
              <span className="text-foreground font-medium">{step.email}</span>.
            </p>
          </div>
          {step.devCode && (
            <Notice>
              Dev mode — no mail provider connected, your code is{" "}
              <span className="font-mono font-semibold">{step.devCode}</span>
            </Notice>
          )}
          <form onSubmit={handleOtpVerify} noValidate className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="otp">One-time code</Label>
              <Input
                id="otp"
                name="otp"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                autoComplete="one-time-code"
                autoFocus
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="h-11 rounded-2xl px-4 text-center font-mono text-lg tracking-[0.4em]"
              />
              <p className="text-muted-foreground text-sm">Valid for 10 minutes.</p>
            </div>
            <Button
              type="submit"
              size="lg"
              className="w-full gap-2"
              disabled={busy !== null || code.length < 6}
            >
              {busy === "otp" && <Spinner />}
              Sign in
            </Button>
          </form>
          {backToStart}
        </>
      )}

      {step.name === "link-sent" && (
        <>
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">Check your email</h1>
            <p className="text-muted-foreground text-sm">
              We sent a sign-in link to{" "}
              <span className="text-foreground font-medium">{step.email}</span>.
              It&apos;s valid for 15 minutes and works once.
            </p>
          </div>
          {step.devLink && (
            <Notice>
              Dev mode — no mail provider connected,{" "}
              <a href={step.devLink} className="font-medium underline underline-offset-2">
                open your sign-in link
              </a>
            </Notice>
          )}
          {backToStart}
        </>
      )}
        </motion.div>
      </AnimatePresence>
    </GlassCard>
  );
}

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 py-6">
      <BackButton href="/" label="Back to home" />
      <div className="flex flex-1 flex-col justify-center gap-8 py-6">
        {/* Wordmark only — no nav, no banners, no marketing. */}
        <span className="text-center text-lg font-semibold tracking-tight">
          Peaches Lounge
        </span>
        <Suspense>
          <LoginForm />
        </Suspense>
        <p className="text-muted-foreground text-center text-xs leading-relaxed">
          Protected by invisible risk checks — no puzzles, ever.
        </p>
      </div>
    </main>
  );
}
