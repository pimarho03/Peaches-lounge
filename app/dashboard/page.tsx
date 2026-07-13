import Link from "next/link";
import { UserCircle } from "@phosphor-icons/react/dist/ssr";

import { requireRole } from "@/lib/auth/guard";
import { BackButton } from "@/components/back-button";
import { BookingHome } from "@/components/booking/booking-home";
import { Button } from "@/components/ui/button";

/** Client home — where members land after the single /login door. */
export default async function DashboardPage() {
  const user = await requireRole("client");

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-6">
      <BackButton href="/" label="Back to home" />
      <div className="flex flex-1 flex-col gap-8 py-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              Welcome back, {user.name.split(" ")[0]}
            </h1>
            <p className="text-muted-foreground">
              Browse the schedule, book a class, and manage your bookings below.
            </p>
          </div>
          <Button variant="secondary" size="icon" asChild>
            <Link href="/dashboard/account" aria-label="Account">
              <UserCircle className="size-5" weight="regular" />
            </Link>
          </Button>
        </div>

        <BookingHome />
      </div>
    </main>
  );
}
