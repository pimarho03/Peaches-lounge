import { listUpcomingClasses } from "@/lib/booking/booking";
import { getSession } from "@/lib/auth/session";

/** Local (server timezone) `YYYY-MM-DD` key — no date library needed. */
function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** "Today" / "Tomorrow" / "Friday, Jul 17" — computed relative to `now`. */
function dayLabel(d: Date, now: Date): string {
  if (dateKey(d) === dateKey(now)) return "Today";
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (dateKey(d) === dateKey(tomorrow)) return "Tomorrow";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(d);
}

/**
 * Upcoming classes for the next 14 days, grouped by local calendar day.
 * Group boundaries and labels are computed server-side (server's local
 * timezone) so the client never needs a date library.
 */
export async function GET() {
  const auth = await getSession();
  if (!auth) {
    return Response.json(
      { ok: false, error: "You need to be signed in." },
      { status: 401 },
    );
  }

  const now = Date.now();
  const nowDate = new Date(now);
  const classes = listUpcomingClasses(now, auth.user.id);

  const groups = new Map<
    string,
    { date: string; label: string; classes: typeof classes }
  >();
  for (const cls of classes) {
    const d = new Date(cls.startsAt);
    const key = dateKey(d);
    let group = groups.get(key);
    if (!group) {
      group = { date: key, label: dayLabel(d, nowDate), classes: [] };
      groups.set(key, group);
    }
    group.classes.push(cls);
  }

  const days = [...groups.values()].map((group) => ({
    date: group.date,
    label: group.label,
    classes: group.classes.map((cls) => ({
      id: cls.id,
      title: cls.title,
      type: cls.type,
      instructor: cls.instructor,
      startsAt: cls.startsAt,
      durationMin: cls.durationMin,
      capacity: cls.capacity,
      bookedCount: cls.bookedCount,
      spotsLeft: cls.spotsLeft,
      waitlistCount: cls.waitlistCount,
      myStatus: cls.myStatus,
      myWaitlistPosition: cls.myWaitlistPosition,
      cancellable: cls.cancellable,
    })),
  }));

  return Response.json({ ok: true, now, days });
}
