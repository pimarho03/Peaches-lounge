import { requireRole } from "@/lib/auth/guard";
import { AccountPanel } from "@/components/account-panel";
import { GlassCard } from "@/components/glass-card";

/** Staff home — same /login door, stronger auth applied automatically. */
export default async function StaffPage() {
  const user = await requireRole("staff", "admin");

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-6 py-12">
      <GlassCard className="flex flex-col gap-4 rounded-3xl p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Staff — schedule &amp; check-ins</h1>
        <p className="text-muted-foreground">
          Signed in as <span className="text-foreground">{user.email}</span> ({user.role}).
          Class rosters and check-in tools will live here.
        </p>
        <AccountPanel passkeys={user.passkeys.length} />
      </GlassCard>
    </main>
  );
}
