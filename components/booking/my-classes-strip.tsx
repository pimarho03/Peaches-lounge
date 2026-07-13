"use client";

import { useMemo } from "react";
import { CalendarCheck } from "@phosphor-icons/react";

import { GlassCard } from "@/components/glass-card";

import type { ScheduleDay } from "@/components/booking/booking-home";

const WEEK_MS = 7 * 24 * 60 * 60_000;

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});

/** Slim summary strip: "N classes this week — Next: {class}, {day} {time}". */
export function MyClassesStrip({ days, now }: { days: ScheduleDay[]; now: number }) {
  const { thisWeek, next } = useMemo(() => {
    const mine = days
      .flatMap((day) => day.classes.map((c) => ({ ...c, dayLabel: day.label })))
      .filter((c) => c.myStatus === "booked" || c.myStatus === "waitlisted")
      .sort((a, b) => a.startsAt - b.startsAt);

    return {
      thisWeek: mine.filter((c) => c.startsAt - now <= WEEK_MS).length,
      next: mine[0] ?? null,
    };
  }, [days, now]);

  if (!next) {
    return (
      <GlassCard className="flex flex-col gap-1 rounded-3xl p-5">
        <p className="text-muted-foreground text-sm">
          No classes booked yet — pick one below.
        </p>
      </GlassCard>
    );
  }

  const time = timeFormatter.format(next.startsAt);
  const suffix = next.myStatus === "waitlisted" ? " (waitlisted)" : "";

  return (
    <GlassCard className="flex flex-col gap-1 rounded-3xl p-5">
      <div className="flex items-center gap-2">
        <CalendarCheck className="text-muted-foreground size-4" weight="regular" />
        <h2 className="font-semibold tracking-tight">
          {thisWeek} {thisWeek === 1 ? "class" : "classes"} this week
        </h2>
      </div>
      <p className="text-muted-foreground text-sm">
        Next: {next.title} · {next.dayLabel}{" "}
        <span className="tabular-nums">{time}</span> with {next.instructor}
        {suffix}
      </p>
    </GlassCard>
  );
}
