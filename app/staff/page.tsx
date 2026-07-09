import { requireRole } from "@/lib/auth/guard";
import { AccountPanel } from "@/components/account-panel";
import { BackButton } from "@/components/back-button";
import { GlassCard } from "@/components/glass-card";

/** Staff home — same /login door, stronger auth applied automatically. */
export default async function StaffPage() {
  const user = await requireRole("staff", "admin");

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-6">
      <BackButton href="/" label="Back to home" />
      <div className="flex flex-1 flex-col justify-center py-6">
        <GlassCard className="flex flex-col gap-4 rounded-3xl p-8">
          <h1 className="text-2xl font-semibold tracking-tight">Staff — schedule &amp; check-ins</h1>
          <p className="text-muted-foreground">
            Signed in as <span className="text-foreground">{user.email}</span> ({user.role}).
            Class rosters and check-in tools will live here.
          </p>
          <AccountPanel passkeys={user.passkeys.length} mfaEnrolled={user.totpSecret !== null} />
        </GlassCard>
      </div>
    </main>
  );
}
