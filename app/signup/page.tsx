"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CircleNotch, Eye, EyeSlash } from "@phosphor-icons/react";

import { BackButton } from "@/components/back-button";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/glass-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Client self-registration. Mirrors the login form's UX rules: labels above
 * fields, on-blur-only validation, password eye toggle, spinner + no
 * duplicate submits, correct mobile keyboards. Server creates a `client`.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 10;

function Spinner() {
  return <CircleNotch className="size-4 animate-spin" weight="bold" />;
}

function FieldError({ id, children }: { id: string; children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="text-danger text-sm">
      {children}
    </p>
  );
}

function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
  }>({});

  const formTokenRef = useRef<string>("");
  const honeypotRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/auth/identify")
      .then((r) => r.json())
      .then((d) => {
        formTokenRef.current = d.formToken ?? "";
      })
      .catch(() => {});
  }, []);

  function setField(field: "name" | "email" | "password", message?: string) {
    setFieldErrors((prev) => ({ ...prev, [field]: message }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    const next: typeof fieldErrors = {};
    if (!name.trim()) next.name = "Tell us what to call you.";
    if (!EMAIL_RE.test(email.trim()))
      next.email = "Enter your email address, like you@example.com.";
    if (password.length < MIN_PASSWORD_LENGTH)
      next.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
    if (Object.keys(next).length) {
      setFieldErrors(next);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          remember,
          formToken: formTokenRef.current,
          website: honeypotRef.current?.value ?? "",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!data.ok) {
        if (data.field) setField(data.field, data.error);
        else setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      const dest = params.get("next");
      router.replace(dest && dest.startsWith("/") ? dest : (data.redirect ?? "/dashboard"));
    } catch {
      setError("We couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <GlassCard className="flex w-full flex-col gap-6 rounded-3xl p-8">
      <input
        ref={honeypotRef}
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute -left-[9999px] size-px opacity-0"
      />

      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
        <p className="text-muted-foreground text-sm">
          Book classes, join waitlists, and manage your bookings.
        </p>
      </div>

      {error && (
        <div role="alert" className="bg-danger/10 text-danger rounded-2xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            autoFocus
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (fieldErrors.name && e.target.value.trim()) setField("name", undefined);
            }}
            onBlur={() => {
              if (!name.trim()) setField("name", "Tell us what to call you.");
            }}
            aria-invalid={fieldErrors.name ? true : undefined}
            aria-describedby={fieldErrors.name ? "name-error" : undefined}
            className="h-11 rounded-2xl px-4"
          />
          <FieldError id="name-error">{fieldErrors.name}</FieldError>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (fieldErrors.email && EMAIL_RE.test(e.target.value.trim()))
                setField("email", undefined);
            }}
            onBlur={() => {
              if (email && !EMAIL_RE.test(email.trim()))
                setField("email", "Enter your email address, like you@example.com.");
            }}
            aria-invalid={fieldErrors.email ? true : undefined}
            aria-describedby={fieldErrors.email ? "email-error" : undefined}
            className="h-11 rounded-2xl px-4"
          />
          <FieldError id="email-error">{fieldErrors.email}</FieldError>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password && e.target.value.length >= MIN_PASSWORD_LENGTH)
                  setField("password", undefined);
              }}
              onBlur={() => {
                if (password && password.length < MIN_PASSWORD_LENGTH)
                  setField("password", `Use at least ${MIN_PASSWORD_LENGTH} characters.`);
              }}
              aria-invalid={fieldErrors.password ? true : undefined}
              aria-describedby={fieldErrors.password ? "password-error" : "password-hint"}
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
          {fieldErrors.password ? (
            <FieldError id="password-error">{fieldErrors.password}</FieldError>
          ) : (
            <p id="password-hint" className="text-muted-foreground text-sm">
              At least {MIN_PASSWORD_LENGTH} characters — a short phrase works well.
            </p>
          )}
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

        <Button type="submit" size="lg" className="w-full gap-2" disabled={busy}>
          {busy && <Spinner />}
          Create account
        </Button>
      </form>

      <p className="text-muted-foreground text-center text-sm">
        Already have an account?{" "}
        <Link href="/login" className="text-foreground font-medium underline underline-offset-2">
          Sign in
        </Link>
      </p>
    </GlassCard>
  );
}

export default function SignupPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 py-6">
      <BackButton href="/login" label="Back to sign in" />
      <div className="flex flex-1 flex-col justify-center gap-8 py-6">
        <span className="text-center text-lg font-semibold tracking-tight">
          Peaches Lounge
        </span>
        <Suspense>
          <SignupForm />
        </Suspense>
      </div>
    </main>
  );
}
