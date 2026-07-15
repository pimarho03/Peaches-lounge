"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { BrandSplash } from "@/components/brand-splash";

const DURATIONS = [2, 3, 4] as const;

/**
 * Interactive controls for the splash tuning page (see ./page.tsx for the
 * noindex metadata). Split into its own client component because the App
 * Router only allows `metadata` exports from Server Components.
 *
 * The light/dark toggle scopes `.dark` to a wrapper div here instead of the
 * real `<html>` element, so tuning this page never flips the rest of the
 * app's theme — CSS custom properties (including --pl-splash-bg/--ink)
 * inherit down the DOM tree the same way regardless of which ancestor holds
 * the class, `position: fixed` doesn't change that.
 */
export function SplashPreviewClient() {
  const [dark, setDark] = useState(false);
  // Default to 3s (the middle of the DURATIONS options below) — the actual
  // production default lives in components/brand-splash.tsx (2.4s) and is
  // unaffected by this page.
  const [duration, setDuration] = useState<number>(3);
  const [replayKey, setReplayKey] = useState(0);

  return (
    <div className={dark ? "dark" : ""}>
      <div className="bg-background text-foreground flex min-h-screen flex-col gap-8 px-6 py-12">
        <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Splash preview
            </h1>
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
              Internal tuning page for the intro splash — not linked from the
              site. Replay plays on demand and never sets the once-per-session
              flag real visitors get.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              size="lg"
              className="h-11 px-6"
              onClick={() => setReplayKey((key) => key + 1)}
            >
              Replay
            </Button>

            <Button
              variant="secondary"
              size="lg"
              className="h-11 px-6"
              aria-pressed={dark}
              onClick={() => setDark((value) => !value)}
            >
              {dark ? "Dark" : "Light"} preview
            </Button>

            <label className="border-input bg-secondary text-secondary-foreground flex h-11 items-center gap-2 rounded-full border px-4 text-sm">
              Draw duration
              <select
                value={duration}
                onChange={(event) => setDuration(Number(event.target.value))}
                className="h-full bg-transparent outline-none"
              >
                {DURATIONS.map((seconds) => (
                  <option key={seconds} value={seconds}>
                    {seconds}s
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* key forces a remount so Replay restarts the draw/fill/lift cycle. */}
        <BrandSplash key={replayKey} force duration={duration} />
      </div>
    </div>
  );
}
