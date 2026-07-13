import "server-only";

export type ClassType = "reformer" | "mat" | "yoga";

export type Instructor = {
  id: string;
  name: string;
};

export type StudioClass = {
  id: string;
  title: string;
  type: ClassType;
  instructorId: string;
  /** Epoch ms. */
  startsAt: number;
  durationMin: number;
  capacity: number;
};

export type BookingStatus = "booked" | "waitlisted" | "cancelled";

export type Booking = {
  id: string;
  classId: string;
  userId: string;
  status: BookingStatus;
  createdAt: number;
  /** Set only while status is (or was) "waitlisted" — orders FIFO promotion. */
  waitlistedAt?: number;
};

type BookingDb = {
  classes: Map<string, StudioClass>;
  instructors: Map<string, Instructor>;
  bookings: Map<string, Booking>;
};

const INSTRUCTORS: Array<{ id: string; name: string }> = [
  { id: "instr_1", name: "Mia K." },
  { id: "instr_2", name: "Faranak N." },
  { id: "instr_3", name: "Jonas R." },
  { id: "instr_4", name: "Priya S." },
];

/** Time-of-day slots (24h local hour, minute) each seeded day draws from. */
const SLOTS: Array<{ hour: number; minute: number }> = [
  { hour: 7, minute: 0 },
  { hour: 9, minute: 0 },
  { hour: 12, minute: 0 },
  { hour: 17, minute: 30 },
  { hour: 19, minute: 0 },
];

const TEMPLATES: Array<{
  title: string;
  type: ClassType;
  durationMin: number;
  capacity: number;
}> = [
  { title: "Reformer Flow", type: "reformer", durationMin: 50, capacity: 8 },
  {
    title: "Reformer Strength (Hard)",
    type: "reformer",
    durationMin: 55,
    capacity: 8,
  },
  { title: "Mat Essentials", type: "mat", durationMin: 45, capacity: 12 },
  { title: "Slow Yoga", type: "yoga", durationMin: 60, capacity: 12 },
  { title: "Power Yoga", type: "yoga", durationMin: 50, capacity: 12 },
];

let idCounter = 0;
/** Monotonic id source — avoids Math.random (unavailable in some contexts). */
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${idCounter}`;
}

/**
 * Returns midnight (local time) for the day `daysFromNow` days after `at`.
 * Used only at seed time to lay out a deterministic 14-day schedule.
 */
function startOfDayOffset(at: Date, daysFromNow: number): Date {
  const d = new Date(at);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + daysFromNow);
  return d;
}

function seed(): BookingDb {
  const instructors = new Map<string, Instructor>();
  for (const i of INSTRUCTORS) instructors.set(i.id, i);

  const classes = new Map<string, StudioClass>();
  const bookings = new Map<string, Booking>();
  const now = Date.now();
  const nowDate = new Date(now);

  const allClasses: StudioClass[] = [];
  for (let day = 0; day < 14; day++) {
    const dayStart = startOfDayOffset(nowDate, day);
    // ~5 classes/day: one per slot, template chosen deterministically so the
    // mix of types repeats predictably across the 14-day window.
    for (const [slotIdx, slot] of SLOTS.entries()) {
      const template = TEMPLATES[(day + slotIdx) % TEMPLATES.length];
      const instructor = INSTRUCTORS[(day + slotIdx) % INSTRUCTORS.length];
      const startsAt = new Date(dayStart);
      startsAt.setHours(slot.hour, slot.minute, 0, 0);
      const cls: StudioClass = {
        id: nextId("class"),
        title: template.title,
        type: template.type,
        instructorId: instructor.id,
        startsAt: startsAt.getTime(),
        durationMin: template.durationMin,
        capacity: template.capacity,
      };
      allClasses.push(cls);
      classes.set(cls.id, cls);
    }
  }

  // Pre-fill a couple of near-future classes so the waitlist flow is
  // exercisable immediately in dev: one completely full, one with a single
  // spot left. Both are picked from classes starting within the next 2 days.
  const soon = allClasses
    .filter((c) => c.startsAt > now && c.startsAt <= now + 2 * 24 * 60 * 60_000)
    .sort((a, b) => a.startsAt - b.startsAt);

  const fullClass = soon[0];
  const nearlyFullClass = soon.find((c) => c.id !== fullClass?.id);

  const seedFakeBooking = (classId: string, userId: string) => {
    const booking: Booking = {
      id: nextId("booking"),
      classId,
      userId,
      status: "booked",
      createdAt: now,
    };
    bookings.set(booking.id, booking);
  };

  if (fullClass) {
    for (let n = 1; n <= fullClass.capacity; n++) {
      seedFakeBooking(fullClass.id, `seed_${n}`);
    }
  }
  if (nearlyFullClass) {
    for (let n = 1; n <= nearlyFullClass.capacity - 1; n++) {
      seedFakeBooking(nearlyFullClass.id, `seed_nf_${n}`);
    }
  }

  return { classes, instructors, bookings };
}

/**
 * In-memory store, stashed on globalThis so it survives dev-server HMR.
 * Swap for a real database (Postgres/Prisma) before launch — the shape of
 * the maps mirrors the tables you'd create.
 */
const globalForBooking = globalThis as unknown as {
  __peachesBookingDb?: BookingDb;
};

export function db(): BookingDb {
  globalForBooking.__peachesBookingDb ??= seed();
  return globalForBooking.__peachesBookingDb;
}

/**
 * Id source for bookings created after seed time (real API calls). Mixes in
 * the current booking count so ids stay unique even after a dev-server HMR
 * reload resets `idCounter` back to 0.
 */
export function newBookingId(): string {
  return `booking_${db().bookings.size + 1}_${nextId("b")}`;
}
