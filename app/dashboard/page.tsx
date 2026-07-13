import { requireRole } from "@/lib/auth/guard";
import { AccountPanel } from "@/components/account-panel";
import { BackButton } from "@/components/back-button";
import { BookingHome } from "@/components/booking/booking-home";
import { GlassCard } from "@/components/glass-card";

/** Client home — where members land after the single /login door. */
export default async function DashboardPage() {
  const user = await requireRole("client");

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-6">
      <BackButton href="/" label="Back to home" />
      <div className="flex flex-1 flex-col gap-8 py-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome back, {user.name.split(" ")[0]}
          </h1>
          <p className="text-muted-foreground">
            Browse the schedule, book a class, and manage your bookings below.
          </p>
        </div>

        <BookingHome />

        <GlassCard className="flex flex-col gap-4 rounded-3xl p-8">
          <h2 className="text-lg font-semibold tracking-tight">Account</h2>
          <p className="text-muted-foreground text-sm">
            Signed in as <span className="text-foreground">{user.email}</span>.
          </p>
          <AccountPanel passkeys={user.passkeys.length} mfaEnrolled={user.totpSecret !== null} />
        </GlassCard>
      </div>
    </main>
  );
}
