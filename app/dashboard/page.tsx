import { requireRole } from "@/lib/auth/guard";
import { AccountPanel } from "@/components/account-panel";
import { GlassCard } from "@/components/glass-card";

/** Client home — where members land after the single /login door. */
export default async function DashboardPage() {
  const user = await requireRole("client");

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-6 py-12">
      <GlassCard className="flex flex-col gap-4 rounded-3xl p-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome back, {user.name.split(" ")[0]}
        </h1>
        <p className="text-muted-foreground">
          You&apos;re signed in as <span className="text-foreground">{user.email}</span>.
          Your upcoming classes and bookings will live here.
        </p>
        <AccountPanel passkeys={user.passkeys.length} />
      </GlassCard>
    </main>
  );
}
