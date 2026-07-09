"use client";

import { useEffect, useState } from "react";

/**
 * Apple-"hello"-style handwriting intro. Draws the "Peaches Lounge" wordmark
 * as a single flowing script stroke, fills it, then lifts away to reveal the
 * app. Plays once per browser-tab session and is fully skipped for anyone who
 * prefers reduced motion.
 *
 * The draw effect is the classic SVG trick: a large `stroke-dasharray` with a
 * matching `stroke-dashoffset` hides the stroke, and animating the offset to
 * zero "writes" it on. Keyframes live in globals.css (`.pl-splash*`).
 */
const SESSION_KEY = "pl-splash-seen";

export function BrandSplash() {
  // Start hidden so repeat navigations never flash the splash; the effect
  // decides on mount whether this session should see it.
  const [state, setState] = useState<"hidden" | "playing" | "leaving">("hidden");

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(SESSION_KEY) === "1";
    } catch {
      // Private-mode / storage disabled — just play it, no harm.
    }
    if (seen) return;
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {}

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Draw + fill runs ~3s; reduced motion shows a brief static hold. Reveal on
    // the next frame so the browser paints once before the overlay mounts.
    const holdMs = reduced ? 700 : 3000;
    const raf = requestAnimationFrame(() => setState("playing"));
    const leave = setTimeout(() => setState("leaving"), holdMs);
    const done = setTimeout(() => setState("hidden"), holdMs + 650);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(leave);
      clearTimeout(done);
    };
  }, []);

  if (state === "hidden") return null;

  return (
    <div
      className={`pl-splash${state === "leaving" ? " pl-splash--leaving" : ""}`}
      aria-hidden="true"
    >
      <svg
        className="pl-splash-svg"
        viewBox="0 0 1000 340"
        role="img"
        aria-label="Peaches Lounge"
      >
        <text
          className="pl-splash-word"
          x="500"
          y="215"
          textAnchor="middle"
          textLength="880"
          lengthAdjust="spacingAndGlyphs"
        >
          Peaches Lounge
        </text>
      </svg>
    </div>
  );
}
