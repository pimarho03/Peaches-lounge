"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  ArrowRight,
  Barbell,
  CheckCircle,
  Clock,
  Coffee,
  Flower,
  MapPin,
  Moon,
  Sun,
  Users,
} from "@phosphor-icons/react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/glass-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ClassItem = {
  name: string;
  time: string;
  instructor: string;
  icon: React.ReactNode;
  spots: number;
};

const CLASSES: ClassItem[] = [
  {
    name: "Reformer Pilates",
    time: "Today · 6:00 PM",
    instructor: "with Faranak",
    icon: <Barbell className="size-5" weight="regular" />,
    spots: 3,
  },
  {
    name: "Vinyasa Yoga",
    time: "Today · 7:30 PM",
    instructor: "with Amir",
    icon: <Flower className="size-5" weight="regular" />,
    spots: 8,
  },
  {
    name: "Meditation + Matcha",
    time: "Tomorrow · 9:00 AM",
    instructor: "with the team",
    icon: <Coffee className="size-5" weight="regular" />,
    spots: 0,
  },
];

/** Render the availability badge for a class based on remaining spots. */
function spotsBadge(spots: number) {
  if (spots === 0) {
    return (
      <Badge className="bg-warning/15 text-warning border-transparent">
        Waitlist
      </Badge>
    );
  }
  if (spots <= 3) {
    return (
      <Badge className="bg-danger/15 text-danger border-transparent">
        {spots} spots left
      </Badge>
    );
  }
  return (
    <Badge className="bg-success/15 text-success border-transparent">
      {spots} spots open
    </Badge>
  );
}

const DARK_QUERY = "(prefers-color-scheme: dark)";

/** Subscribe to OS dark-mode changes; returns an unsubscribe fn for useSyncExternalStore. */
function subscribeToScheme(callback: () => void) {
  const mql = window.matchMedia(DARK_QUERY);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

/** Peaches Lounge landing + booking preview: hero, weekly schedule, and waitlist. */
export default function Home() {
  // Track the live OS preference; server snapshot falls back to light to avoid
  // a hydration mismatch. useSyncExternalStore avoids the set-state-in-effect
  // re-render and keeps reacting to OS theme changes after mount.
  const systemPrefersDark = useSyncExternalStore(
    subscribeToScheme,
    () => window.matchMedia(DARK_QUERY).matches,
    () => false,
  );
  const [override, setOverride] = useState<boolean | null>(null);
  const dark = override ?? systemPrefersDark;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-16 px-6 py-10 sm:py-16">
      {/* Top bar */}
      <header className="flex items-center justify-between">
        <span className="text-lg font-semibold tracking-tight">
          Peaches Lounge
        </span>
        <Button
          variant="secondary"
          size="icon"
          aria-label="Toggle dark mode"
          onClick={() => setOverride((v) => !(v ?? systemPrefersDark))}
        >
          {dark ? (
            <Sun className="size-5" weight="regular" />
          ) : (
            <Moon className="size-5" weight="regular" />
          )}
        </Button>
      </header>

      {/* Hero */}
      <section className="flex flex-col gap-6">
        <Badge
          variant="secondary"
          className="w-fit gap-1.5 rounded-full px-3 py-1 font-normal"
        >
          <MapPin className="size-3.5" weight="fill" />
          Ambleside · West Vancouver
        </Badge>
        <h1 className="max-w-2xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          Pilates, yoga, and matcha — in one calm, curved little world.
        </h1>
        <p className="text-muted-foreground max-w-xl text-lg leading-relaxed">
          Book a reformer class, flow through yoga, or just come for the matcha.
          Community-first, premium, and never corporate.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" className="gap-2">
            Book a class
            <ArrowRight className="size-4" weight="bold" />
          </Button>
          <Button size="lg" variant="secondary">
            View the schedule
          </Button>
        </div>
      </section>

      {/* This week */}
      <section className="flex flex-col gap-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-2xl font-semibold tracking-tight">This week</h2>
          <span className="text-muted-foreground text-sm">
            10 reformers · 900 sq ft
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {CLASSES.map((c) => (
            <GlassCard key={c.name} className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="bg-primary text-primary-foreground flex size-10 items-center justify-center rounded-full">
                  {c.icon}
                </span>
                {spotsBadge(c.spots)}
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="font-semibold">{c.name}</h3>
                <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
                  <Clock className="size-3.5" weight="regular" />
                  {c.time}
                </span>
                <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
                  <Users className="size-3.5" weight="regular" />
                  {c.instructor}
                </span>
              </div>
              <Button
                variant={c.spots === 0 ? "secondary" : "default"}
                className="w-full"
              >
                {c.spots === 0 ? "Join waitlist" : "Reserve spot"}
              </Button>
            </GlassCard>
          ))}
        </div>
      </section>

      {/* Waitlist form */}
      <section>
        <GlassCard className="flex flex-col gap-5 rounded-3xl sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-semibold tracking-tight">
              Join the founding members list
            </h2>
            <p className="text-muted-foreground text-sm">
              Be first in line when the doors open. No spam — just your spot.
            </p>
          </div>
          <form
            className="flex w-full max-w-sm flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const email = new FormData(e.currentTarget)
                .get("email")
                ?.toString()
                .trim();
              if (!email) return;
              // TODO: wire to the founding-members list backend.
              console.log("Waitlist signup:", email);
              e.currentTarget.reset();
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                placeholder="you@example.com"
              />
            </div>
            <Button type="submit" className="w-full gap-2">
              <CheckCircle className="size-4" weight="fill" />
              Reserve my spot
            </Button>
          </form>
        </GlassCard>
      </section>

      <footer className="text-muted-foreground border-border mt-auto border-t pt-6 text-sm">
        Peaches Lounge · Pilates · Yoga · Matcha Bar — West Vancouver, BC
      </footer>
    </div>
  );
}
