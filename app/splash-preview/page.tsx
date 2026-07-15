import type { Metadata } from "next";

import { SplashPreviewClient } from "./splash-preview-client";

/**
 * Internal tuning page for the intro splash (components/brand-splash.tsx).
 * Deliberately public (not gated by proxy.ts / APP_SURFACES — the owner
 * needs it reachable in production for quick checks) but noindex/unlisted:
 * not linked from the site nav and excluded from search results below.
 */
export const metadata: Metadata = {
  title: "Splash preview — Peaches Lounge",
  robots: {
    index: false,
    follow: false,
  },
};

export default function SplashPreviewPage() {
  return <SplashPreviewClient />;
}
