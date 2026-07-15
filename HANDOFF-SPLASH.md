# Handoff: exact-logo splash animation (continue from here)

## Where the vectorized logo lives (all committed or on disk)
- **Traced SVG (source of truth):** `public/brand/logo-traced.svg` — potrace output of the real
  Gemini logo. viewBox `0 0 2824.787549 717.380775`, group transform
  `translate(-190.058945,1022.930872) scale(0.100000,-0.100000)`, 3 paths, fill-rule evenodd.
- **Inlined copies:** `components/brand-splash.tsx` → constants `LOGO_TRANSFORM`, `LOGO_PATHS`
  (3 path d-strings), `CENTERLINE_D` (60-point handwriting pen path, same viewBox coords).
- **Pen-path length (hardcoded, computed mathematically):** `2973` — used as
  stroke-dasharray/dashoffset in `app/globals.css` (`.pl-splash-reveal`).
- **✅ WORKING reference implementation:** `public/splash-test.html` — static page, zero React,
  same SVG + mask + keyframes. Open http://localhost:3000/splash-test.html — it draws perfectly,
  bolder letters (letters group has stroke=currentColor strokeWidth=220 for weight). USE THIS AS
  THE KNOWN-GOOD BASELINE.

## Current state
- Website repo branch `claude/web-ios-app-comparison-e5ceb5`, splash committed at f0b2df8 +
  uncommitted tweaks (size 52vw/620px, thicker letters stroke 220, hardcoded dash 2973).
- `/splash-preview` page = tuning UI (Replay, Light/Dark, duration select). Component contract:
  `<BrandSplash force duration={n} />`.

## THE OPEN BUG (React version only)
Static test page works perfectly; the React splash renders only a frozen round-cap blob at the
pen path's start (= dashoffset stuck at full length). Verified NOT stale-cache (server restarted,
.next cleared), NOT reduced-motion, NOT hydration timing (waited 6s, real click).
**Hot lead, last thing checked:** grep of the compiled CSS chunk for `pl-splash-reveal` and
`@keyframes pl-reveal` returned NOTHING — the custom classes may be missing/renamed in the
Tailwind-v4 (Lightning CSS) build output. Diff the compiled CSS at
`/_next/static/chunks/*.css` against `app/globals.css`. If the rules are absent, the fix is
likely moving the splash CSS into a `@layer` Tailwind v4 preserves, or importing it as a
separate plain-CSS file, or inlining the animation styles into the component.
**Important environment gotcha:** this worktree lives under a hidden `.claude/` dir — the dev
server's file watcher DOES NOT see edits; restart the dev server (and sometimes `rm -rf .next`)
after every change. (Same class of bug cost hours on the iOS side with Metro.)

## After the bug is fixed
1. Owner (Amir) reviews on `/splash-preview` (size currently 52vw/620px per his feedback).
2. Commit + PR to main → Vercel auto-deploys to peacheslounge.com.
3. **iOS port** (his explicit ask): same LOGO_PATHS/CENTERLINE_D/2973 into the Expo app at
   `~/Desktop/peaches-lounge-app` as the launch splash, replacing `components/IntroSplash.tsx`
   (currently a width-reveal of the raster logo). Needs `npx expo install react-native-svg` +
   `npx expo run:ios` rebuild. Animate dashoffset 2973→0 with Animated; white-on-black.
4. Pending owner paste in Supabase SQL editor: migration `011_email_logo.sql` (iOS repo,
   adds the hosted logo header to all emails — logo file already at
   `~/Peaches-lounge/public/brand/email-logo.png`, deploys with next site merge).

## Foreman ledger (full session history)
`~/Desktop/peaches-lounge-app/.foreman/ledger.md`
