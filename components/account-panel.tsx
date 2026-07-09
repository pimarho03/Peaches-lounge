"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { startRegistration } from "@simplewebauthn/browser";
import {
  CheckCircle,
  CircleNotch,
  Fingerprint,
  ShieldCheck,
  SignOut,
} from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type EnrollState =
  | { phase: "idle" }
  | { phase: "scanning"; qr: string; secret: string; code: string; error?: string };

/** Sign-out, passkey enrollment, and authenticator (2FA) setup — shared. */
export function AccountPanel({
  passkeys,
  mfaEnrolled,
}: {
  passkeys: number;
  mfaEnrolled: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [enrolled, setEnrolled] = useState(passkeys);
  const [hasTotp, setHasTotp] = useState(mfaEnrolled);
  const [enroll, setEnroll] = useState<EnrollState>({ phase: "idle" });

  async function addPasskey() {
    if (busy) return;
    setBusy("passkey");
    setMessage(null);
    try {
      const optRes = await fetch("/api/auth/passkey/register", { method: "POST" });
      const opt = await optRes.json();
      if (!opt.ok) throw new Error();
      const response = await startRegistration({ optionsJSON: opt.options });
      const verifyRes = await fetch("/api/auth/passkey/register", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeKey: opt.challengeKey, response }),
      });
      const verified = await verifyRes.json();
      if (!verified.ok) throw new Error(verified.error);
      setEnrolled((n) => n + 1);
      setMessage("Passkey added — next time, sign in with FaceID / TouchID / Windows Hello.");
    } catch (err) {
      if (err instanceof Error && err.name === "NotAllowedError") return;
      setMessage("Couldn't add a passkey on this device.");
    } finally {
      setBusy(null);
    }
  }

  async function startEnroll() {
    if (busy) return;
    setBusy("totp-start");
    setMessage(null);
    try {
      const res = await fetch("/api/auth/mfa/enroll", { method: "POST" });
      const data = await res.json();
      if (!data.ok) throw new Error();
      setEnroll({ phase: "scanning", qr: data.qr, secret: data.secret, code: "" });
    } catch {
      setMessage("Couldn't start authenticator setup. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function confirmEnroll() {
    if (busy || enroll.phase !== "scanning") return;
    setBusy("totp-confirm");
    try {
      const res = await fetch("/api/auth/mfa/enroll", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: enroll.code }),
      });
      const data = await res.json();
      if (!data.ok) {
        if (data.restart) setEnroll({ phase: "idle" });
        else setEnroll({ ...enroll, error: data.error });
        return;
      }
      setHasTotp(true);
      setEnroll({ phase: "idle" });
      setMessage("Authenticator app connected — you'll enter a code from it when signing in.");
    } finally {
      setBusy(null);
    }
  }

  async function signOut() {
    if (busy) return;
    setBusy("signout");
    await fetch("/api/auth/session", { method: "DELETE" });
    router.replace("/login");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" className="gap-2" onClick={addPasskey} disabled={busy !== null}>
          {busy === "passkey" ? (
            <CircleNotch className="size-4 animate-spin" weight="bold" />
          ) : (
            <Fingerprint className="size-4" weight="regular" />
          )}
          {enrolled > 0 ? `Add another passkey (${enrolled} active)` : "Set up a passkey"}
        </Button>

        {hasTotp ? (
          <span className="text-success inline-flex items-center gap-1.5 text-sm font-medium">
            <ShieldCheck className="size-4" weight="fill" />
            Authenticator 2FA on
          </span>
        ) : (
          enroll.phase === "idle" && (
            <Button variant="secondary" className="gap-2" onClick={startEnroll} disabled={busy !== null}>
              {busy === "totp-start" ? (
                <CircleNotch className="size-4 animate-spin" weight="bold" />
              ) : (
                <ShieldCheck className="size-4" weight="regular" />
              )}
              Set up authenticator (2FA)
            </Button>
          )
        )}

        <Button variant="outline" className="gap-2" onClick={signOut} disabled={busy !== null}>
          {busy === "signout" ? (
            <CircleNotch className="size-4 animate-spin" weight="bold" />
          ) : (
            <SignOut className="size-4" weight="regular" />
          )}
          Sign out
        </Button>
      </div>

      {enroll.phase === "scanning" && (
        <div className="border-border flex flex-col gap-4 rounded-2xl border p-4 sm:flex-row sm:items-center">
          <Image
            src={enroll.qr}
            alt="Authenticator QR code"
            width={160}
            height={160}
            unoptimized
            className="mx-auto rounded-xl bg-white p-2 sm:mx-0"
          />
          <div className="flex flex-1 flex-col gap-2">
            <p className="text-sm">
              Scan with Google Authenticator, Authy, or 1Password — or enter this key manually:
            </p>
            <code className="bg-muted text-muted-foreground rounded-lg px-2 py-1 font-mono text-xs break-all">
              {enroll.secret}
            </code>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="enroll-code">Enter the 6-digit code to confirm</Label>
              <div className="flex gap-2">
                <Input
                  id="enroll-code"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  autoComplete="one-time-code"
                  value={enroll.code}
                  onChange={(e) =>
                    setEnroll({ ...enroll, code: e.target.value.replace(/\D/g, ""), error: undefined })
                  }
                  className="h-10 max-w-[8rem] rounded-xl px-3 text-center font-mono tracking-[0.3em]"
                />
                <Button
                  className="gap-2"
                  onClick={confirmEnroll}
                  disabled={busy !== null || enroll.code.length < 6}
                >
                  {busy === "totp-confirm" ? (
                    <CircleNotch className="size-4 animate-spin" weight="bold" />
                  ) : (
                    <CheckCircle className="size-4" weight="fill" />
                  )}
                  Confirm
                </Button>
              </div>
              {enroll.error && (
                <p role="alert" className="text-danger text-sm">
                  {enroll.error}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {message && <p className="text-muted-foreground text-sm">{message}</p>}
    </div>
  );
}
