"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CheckCircle } from "@phosphor-icons/react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/glass-card";
import { cn } from "@/lib/utils";

import type { ClassType, ScheduleClass, ScheduleDay } from "@/components/booking/booking-home";
import { BookingSheet, type SheetAction } from "@/components/booking/booking-sheet";

const FILTERS: { value: ClassType | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "reformer", label: "Reformer" },
  { value: "mat", label: "Mat" },
  { value: "yoga", label: "Yoga" },
];

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});

type SheetState = {
  classItem: ScheduleClass;
  dayLabel: string;
  action: SheetAction;
  trigger: HTMLElement | null;
};

function StateButton({
  classItem,
  onBook,
  onWaitlist,
  onCancel,
  onLeaveWaitlist,
}: {
  classItem: ScheduleClass;
  onBook: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onWaitlist: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onCancel: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onLeaveWaitlist: (e: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  if (classItem.myStatus === "booked") {
    return (
      <Button variant="outline" size="sm" className="gap-1.5" onClick={onCancel}>
        <CheckCircle className="size-4" weight="fill" />
        Booked
      </Button>
    );
  }
  if (classItem.myStatus === "waitlisted") {
    return (
      <Button variant="secondary" size="sm" onClick={onLeaveWaitlist}>
        Waitlisted{" "}
        {classItem.myWaitlistPosition ? `#${classItem.myWaitlistPosition}` : ""}
      </Button>
    );
  }
  if (classItem.spotsLeft > 0) {
    return (
      <Button size="sm" onClick={onBook}>
        Book
      </Button>
    );
  }
  return (
    <Button variant="secondary" size="sm" onClick={onWaitlist}>
      Waitlist
    </Button>
  );
}

function ClassCard({
  classItem,
  onOpenSheet,
}: {
  classItem: ScheduleClass;
  onOpenSheet: (action: SheetAction, trigger: HTMLElement) => void;
}) {
  const time = timeFormatter.format(classItem.startsAt);
  const low = classItem.spotsLeft > 0 && classItem.spotsLeft <= 2;

  return (
    <GlassCard className="flex items-center gap-4 rounded-3xl p-5">
      <div className="flex w-16 shrink-0 flex-col">
        <span className="tabular-nums font-semibold">{time}</span>
        <span className="text-muted-foreground text-xs">{classItem.durationMin} min</span>
      </div>

      <div className="flex flex-1 flex-col gap-1">
        <span className="font-semibold tracking-tight">{classItem.title}</span>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{classItem.instructor}</span>
          <Badge variant="secondary" className="capitalize">
            {classItem.type}
          </Badge>
        </div>
        <span
          className={cn(
            "text-xs",
            classItem.spotsLeft === 0
              ? "text-muted-foreground"
              : low
                ? "text-warning"
                : "text-muted-foreground",
          )}
        >
          {classItem.spotsLeft > 0
            ? `${classItem.spotsLeft} spot${classItem.spotsLeft === 1 ? "" : "s"} left`
            : classItem.waitlistCount > 0
              ? `Full · ${classItem.waitlistCount} waiting`
              : "Full — waitlist"}
        </span>
      </div>

      <StateButton
        classItem={classItem}
        onBook={(e) => onOpenSheet("book", e.currentTarget)}
        onWaitlist={(e) => onOpenSheet("waitlist", e.currentTarget)}
        onCancel={(e) => onOpenSheet("cancel", e.currentTarget)}
        onLeaveWaitlist={(e) => onOpenSheet("leave-waitlist", e.currentTarget)}
      />
    </GlassCard>
  );
}

/**
 * Filter chips + day-grouped class list. Renders the booking confirmation
 * sheet on demand and calls onChanged() (the parent's single refresh) after
 * a successful book/cancel so strip + list stay in sync.
 */
export function ClassSchedule({
  days,
  onChanged,
}: {
  days: ScheduleDay[];
  onChanged: () => void;
}) {
  const [filter, setFilter] = useState<ClassType | "all">("all");
  const [sheet, setSheet] = useState<SheetState | null>(null);

  const filteredDays = useMemo(() => {
    return days
      .map((day) => ({
        ...day,
        classes: day.classes.filter((c) => filter === "all" || c.type === filter),
      }))
      .filter((day) => day.classes.length > 0);
  }, [days, filter]);

  // Index every class (unfiltered) so the sheet can find fresh data by id
  // even after a filter change swaps the visible list out from under it.
  const classIndex = useMemo(() => {
    const map = new Map<string, { classItem: ScheduleClass; dayLabel: string }>();
    for (const day of days) {
      for (const c of day.classes) {
        map.set(c.id, { classItem: c, dayLabel: day.label });
      }
    }
    return map;
  }, [days]);

  const prefersReduced = useReducedMotion();
  const listVariants = prefersReduced
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 } };
  const listTransition = prefersReduced
    ? { duration: 0.15 }
    : ({ type: "spring", bounce: 0, duration: 0.32 } as const);

  function openSheet(classId: string, action: SheetAction, trigger: HTMLElement) {
    const entry = classIndex.get(classId);
    if (!entry) return;
    setSheet({ classItem: entry.classItem, dayLabel: entry.dayLabel, action, trigger });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="glass inline-flex w-fit gap-1 rounded-full p-1">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={cn(
              "active:scale-[0.97] rounded-full px-3.5 py-1.5 text-sm font-medium transition-all active:duration-100",
              filter === f.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
            aria-pressed={filter === f.value}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filteredDays.length === 0 && (
        <p className="text-muted-foreground text-sm">No classes match this filter.</p>
      )}

      <AnimatePresence mode="popLayout" initial={false}>
        {filteredDays.map((day) => (
          <motion.div
            key={day.date + filter}
            variants={listVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={listTransition}
            className="flex flex-col gap-3"
          >
            <span className="text-muted-foreground text-sm font-semibold tracking-wide">
              {day.label}
            </span>
            <div className="flex flex-col gap-3">
              {day.classes.map((c) => (
                <ClassCard
                  key={c.id}
                  classItem={c}
                  onOpenSheet={(action, trigger) => openSheet(c.id, action, trigger)}
                />
              ))}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      <AnimatePresence>
        {sheet && (
          <BookingSheet
            key={sheet.classItem.id + sheet.action}
            classItem={sheet.classItem}
            dayLabel={sheet.dayLabel}
            action={sheet.action}
            trigger={sheet.trigger}
            onClose={() => setSheet(null)}
            onSuccess={onChanged}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
