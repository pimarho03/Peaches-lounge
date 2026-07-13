import { requireRole } from "@/lib/auth/guard";
import { AccountPanel } from "@/components/account-panel";
import { BackButton } from "@/components/back-button";
import { GlassCard } from "@/components/glass-card";

/** Account settings — moved off the booking screen so the schedule stays focused. */
export default async function AccountPage() {
  const user = await requireRole("client");

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-6">
      <BackButton href="/dashboard" label="Back to schedule" />
      <div className="flex flex-1 flex-col gap-8 py-6">
        <h1 className="text-2xl font-semibold tracking-tight">Account</h1>

        <GlassCard className="flex flex-col gap-4 rounded-3xl p-8">
          <p className="text-muted-foreground text-sm">
            Signed in as <span className="text-foreground">{user.email}</span>.
          </p>
          <AccountPanel passkeys={user.passkeys.length} mfaEnrolled={user.totpSecret !== null} />
        </GlassCard>
      </div>
    </main>
  );
}
