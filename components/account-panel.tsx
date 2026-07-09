"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startRegistration } from "@simplewebauthn/browser";
import { CircleNotch, Fingerprint, SignOut } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";

/** Sign-out + passkey enrollment, shared by every signed-in area. */
export function AccountPanel({ passkeys }: { passkeys: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [enrolled, setEnrolled] = useState(passkeys);

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

  async function signOut() {
    if (busy) return;
    setBusy("signout");
    await fetch("/api/auth/session", { method: "DELETE" });
    router.replace("/login");
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        <Button
          variant="secondary"
          className="gap-2"
          onClick={addPasskey}
          disabled={busy !== null}
        >
          {busy === "passkey" ? (
            <CircleNotch className="size-4 animate-spin" weight="bold" />
          ) : (
            <Fingerprint className="size-4" weight="regular" />
          )}
          {enrolled > 0 ? `Add another passkey (${enrolled} active)` : "Set up a passkey"}
        </Button>
        <Button
          variant="outline"
          className="gap-2"
          onClick={signOut}
          disabled={busy !== null}
        >
          {busy === "signout" ? (
            <CircleNotch className="size-4 animate-spin" weight="bold" />
          ) : (
            <SignOut className="size-4" weight="regular" />
          )}
          Sign out
        </Button>
      </div>
      {message && <p className="text-muted-foreground text-sm">{message}</p>}
    </div>
  );
}
