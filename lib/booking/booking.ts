import "server-only";

import { db, newBookingId, type Booking, type ClassType } from "./store";

/** Cancelling within this window of the class start is blocked (booked seats only). */
export const CANCEL_CUTOFF_MS = 6 * 60 * 60_000;

export type MyStatus = "booked" | "waitlisted" | null;

export type UpcomingClass = {
  id: string;
  title: string;
  type: ClassType;
  instructorId: string;
  instructor: string;
  startsAt: number;
  durationMin: number;
  capacity: number;
  bookedCount: number;
  spotsLeft: number;
  waitlistCount: number;
  myStatus: MyStatus;
  myWaitlistPosition: number | null;
  cancellable: boolean;
};

export type BookResult =
  | { ok: true; status: "booked" | "waitlisted"; waitlistPosition: number | null }
  | { ok: false; error: "not-found" | "started" | "already-booked" };

export type CancelResult =
  | { ok: true; promotedUserId: string | null }
  | { ok: false; error: "not-found" | "cutoff"; cutoffAt?: number };

/** Active (not cancelled) bookings for a class, ordered by createdAt. */
function activeBookingsForClass(classId: string): Booking[] {
  return [...db().bookings.values()]
    .filter((b) => b.classId === classId && b.status !== "cancelled")
    .sort((a, b) => a.createdAt - b.createdAt);
}

function waitlistForClass(classId: string): Booking[] {
  return activeBookingsForClass(classId)
    .filter((b) => b.status === "waitlisted")
    .sort((a, b) => (a.waitlistedAt ?? 0) - (b.waitlistedAt ?? 0));
}

function findActiveBooking(classId: string, userId: string): Booking | undefined {
  return [...db().bookings.values()].find(
    (b) => b.classId === classId && b.userId === userId && b.status !== "cancelled",
  );
}

function isCancellable(myStatus: MyStatus, startsAt: number, now: number): boolean {
  if (myStatus === null) return false;
  if (myStatus === "waitlisted") return true;
  return startsAt - now > CANCEL_CUTOFF_MS;
}

/**
 * Classes starting after `now`, sorted chronologically, joined with
 * instructor name and (when `userId` is given) the caller's booking state.
 */
export function listUpcomingClasses(now: number, userId?: string): UpcomingClass[] {
  const { classes, instructors } = db();
  const upcoming = [...classes.values()]
    .filter((c) => c.startsAt > now)
    .sort((a, b) => a.startsAt - b.startsAt);

  return upcoming.map((cls) => {
    const active = activeBookingsForClass(cls.id);
    const booked = active.filter((b) => b.status === "booked");
    const waitlist = active
      .filter((b) => b.status === "waitlisted")
      .sort((a, b) => (a.waitlistedAt ?? 0) - (b.waitlistedAt ?? 0));

    let myStatus: MyStatus = null;
    let myWaitlistPosition: number | null = null;
    if (userId) {
      const mine = findActiveBooking(cls.id, userId);
      if (mine) {
        myStatus = mine.status === "booked" ? "booked" : "waitlisted";
        if (mine.status === "waitlisted") {
          myWaitlistPosition = waitlist.findIndex((b) => b.id === mine.id) + 1;
        }
      }
    }

    return {
      id: cls.id,
      title: cls.title,
      type: cls.type,
      instructorId: cls.instructorId,
      instructor: instructors.get(cls.instructorId)?.name ?? "TBA",
      startsAt: cls.startsAt,
      durationMin: cls.durationMin,
      capacity: cls.capacity,
      bookedCount: booked.length,
      spotsLeft: Math.max(0, cls.capacity - booked.length),
      waitlistCount: waitlist.length,
      myStatus,
      myWaitlistPosition,
      cancellable: isCancellable(myStatus, cls.startsAt, now),
    };
  });
}

/**
 * Books `userId` into `classId`, or waitlists them (FIFO) if the class is
 * already at capacity. Re-booking after a prior cancellation reuses the
 * cancelled row (flips its status) instead of creating a duplicate
 * (classId,userId) active row.
 */
export function bookClass(userId: string, classId: string, now: number): BookResult {
  const cls = db().classes.get(classId);
  if (!cls) return { ok: false, error: "not-found" };
  if (cls.startsAt <= now) return { ok: false, error: "started" };

  const existing = findActiveBooking(classId, userId);
  if (existing) return { ok: false, error: "already-booked" };

  const bookedCount = activeBookingsForClass(classId).filter(
    (b) => b.status === "booked",
  ).length;
  const hasSpot = bookedCount < cls.capacity;

  // Reuse a cancelled row for this (classId, userId) pair if one exists —
  // never create a second row for the same member/class combination.
  const cancelledRow = [...db().bookings.values()].find(
    (b) => b.classId === classId && b.userId === userId && b.status === "cancelled",
  );

  const status: "booked" | "waitlisted" = hasSpot ? "booked" : "waitlisted";
  const waitlistedAt = status === "waitlisted" ? now : undefined;

  if (cancelledRow) {
    cancelledRow.status = status;
    cancelledRow.createdAt = now;
    cancelledRow.waitlistedAt = waitlistedAt;
  } else {
    const booking: Booking = {
      id: newBookingId(),
      classId,
      userId,
      status,
      createdAt: now,
      waitlistedAt,
    };
    db().bookings.set(booking.id, booking);
  }

  let waitlistPosition: number | null = null;
  if (status === "waitlisted") {
    const waitlist = waitlistForClass(classId);
    waitlistPosition = waitlist.findIndex((b) => b.userId === userId) + 1;
  }

  return { ok: true, status, waitlistPosition };
}

/**
 * Cancels `userId`'s active booking for `classId`. Waitlisted members may
 * leave anytime; booked members are blocked within `CANCEL_CUTOFF_MS` of the
 * class start. Freeing a booked seat auto-promotes the earliest waitlisted
 * member (FIFO by `waitlistedAt`).
 */
export function cancelBooking(userId: string, classId: string, now: number): CancelResult {
  const cls = db().classes.get(classId);
  const existing = findActiveBooking(classId, userId);
  if (!existing) return { ok: false, error: "not-found" };

  if (
    existing.status === "booked" &&
    cls &&
    cls.startsAt - now <= CANCEL_CUTOFF_MS
  ) {
    return { ok: false, error: "cutoff", cutoffAt: cls.startsAt - CANCEL_CUTOFF_MS };
  }

  const freedSeat = existing.status === "booked";
  existing.status = "cancelled";

  let promotedUserId: string | null = null;
  if (freedSeat) {
    const [next] = waitlistForClass(classId);
    if (next) {
      next.status = "booked";
      promotedUserId = next.userId;
    }
  }

  return { ok: true, promotedUserId };
}

export type MyUpcomingBooking = {
  bookingId: string;
  classId: string;
  title: string;
  type: ClassType;
  instructor: string;
  startsAt: number;
  durationMin: number;
  status: "booked" | "waitlisted";
  waitlistPosition: number | null;
};

/** Active bookings for `userId` on classes still in the future, soonest first. */
export function myUpcoming(userId: string, now: number): MyUpcomingBooking[] {
  const { classes, instructors, bookings } = db();
  const mine = [...bookings.values()].filter(
    (b) => b.userId === userId && b.status !== "cancelled",
  );

  const result: MyUpcomingBooking[] = [];
  for (const booking of mine) {
    const cls = classes.get(booking.classId);
    if (!cls || cls.startsAt <= now) continue;
    let waitlistPosition: number | null = null;
    const status: "booked" | "waitlisted" =
      booking.status === "waitlisted" ? "waitlisted" : "booked";
    if (status === "waitlisted") {
      const waitlist = waitlistForClass(cls.id);
      waitlistPosition = waitlist.findIndex((b) => b.id === booking.id) + 1;
    }
    result.push({
      bookingId: booking.id,
      classId: cls.id,
      title: cls.title,
      type: cls.type,
      instructor: instructors.get(cls.instructorId)?.name ?? "TBA",
      startsAt: cls.startsAt,
      durationMin: cls.durationMin,
      status,
      waitlistPosition,
    });
  }

  return result.sort((a, b) => a.startsAt - b.startsAt);
}
