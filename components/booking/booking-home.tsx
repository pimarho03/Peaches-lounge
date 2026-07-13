"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowClockwise } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";

import { ClassSchedule } from "@/components/booking/class-schedule";
import { MyClassesStrip } from "@/components/booking/my-classes-strip";

/** Mirrors the frozen GET /api/classes contract. */
export type ClassType = "reformer" | "mat" | "yoga";

export type ScheduleClass = {
  id: string;
  title: string;
  type: ClassType;
  instructor: string;
  startsAt: number;
  durationMin: number;
  capacity: number;
  bookedCount: number;
  spotsLeft: number;
  waitlistCount: number;
  myStatus: "booked" | "waitlisted" | null;
  myWaitlistPosition: number | null;
  cancellable: boolean;
};

export type ScheduleDay = {
  date: string;
  label: string;
  classes: ScheduleClass[];
};

type LoadState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; now: number; days: ScheduleDay[] };

function FormError({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <div
      role="alert"
      className="bg-danger/10 text-danger rounded-2xl px-4 py-3 text-sm"
    >
      {children}
    </div>
  );
}

/** Pure fetch — no side effects, so callers can setState from a .then(). */
async function fetchSchedule(): Promise<LoadState> {
  try {
    const res = await fetch("/api/classes");
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      return {
        phase: "error",
        message: data.error ?? "Couldn't load the schedule. Please try again.",
      };
    }
    return { phase: "ready", now: data.now, days: data.days ?? [] };
  } catch {
    return {
      phase: "error",
      message: "We couldn't reach the server. Check your connection and try again.",
    };
  }
}

/**
 * Client parent for Feature 1 — fetches the schedule once, holds it, and
 * hands the data + a refresh() callback down to the strip and the schedule
 * so a single fetch backs both surfaces (mirrors the single-source-of-truth
 * pattern in app/login/page.tsx).
 */
export function BookingHome() {
  const [state, setState] = useState<LoadState>({ phase: "loading" });

  const load = useCallback(() => {
    fetchSchedule().then(setState);
  }, []);

  useEffect(() => {
    let active = true;
    fetchSchedule().then((result) => {
      if (active) setState(result);
    });
    return () => {
      active = false;
    };
  }, []);

  if (state.phase === "loading") {
    return (
      <div className="flex flex-col gap-4">
        <div className="bg-muted h-24 animate-pulse rounded-3xl" />
        <div className="flex flex-col gap-3">
          <div className="bg-muted h-24 animate-pulse rounded-3xl" />
          <div className="bg-muted h-24 animate-pulse rounded-3xl" />
          <div className="bg-muted h-24 animate-pulse rounded-3xl" />
        </div>
      </div>
    );
  }

  if (state.phase === "error") {
    return (
      <div className="flex flex-col gap-3">
        <FormError>{state.message}</FormError>
        <Button variant="secondary" className="w-fit gap-2" onClick={load}>
          <ArrowClockwise className="size-4" weight="bold" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <MyClassesStrip days={state.days} now={state.now} />
      <ClassSchedule days={state.days} onChanged={load} />
    </div>
  );
}
