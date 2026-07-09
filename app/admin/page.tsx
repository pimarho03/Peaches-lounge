import { requireRole } from "@/lib/auth/guard";
import { AccountPanel } from "@/components/account-panel";
import { GlassCard } from "@/components/glass-card";

/** Admin home — same /login door, MFA always enforced server-side. */
export default async function AdminPage() {
  const user = await requireRole("admin");

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-6 py-12">
      <GlassCard className="flex flex-col gap-4 rounded-3xl p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Admin — studio controls</h1>
        <p className="text-muted-foreground">
          Signed in as <span className="text-foreground">{user.email}</span>.
          Pricing, staff accounts, and reports will live here.
        </p>
        <AccountPanel passkeys={user.passkeys.length} />
      </GlassCard>
    </main>
  );
}
