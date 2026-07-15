import type { Metadata, Viewport } from "next";
import { Inter, Geist_Mono, Sacramento } from "next/font/google";
import "./globals.css";

import { BrandSplash } from "@/components/brand-splash";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Thin cursive script — no longer used by the splash (see Pacifico below), but
// components/brand-wordmark.tsx still references --font-script, so it stays.
const sacramento = Sacramento({
  variable: "--font-script",
  subsets: ["latin"],
  weight: "400",
});

// Bold, rounded, connected script — closest Google Font match to the real
// logo's lettering. Used by the splash wordmark (components/brand-splash.tsx).

const SITE_DESCRIPTION =
  "Peaches Lounge is a reformer Pilates, yoga, and matcha bar in West Vancouver — a calm, curved little world built for genuine community, not just a workout.";

// Absolute URL (not a relative path + metadataBase) to match the existing
// openGraph.url convention below and avoid a build error, since no
// metadataBase is configured. The stacked logo is 2048x2048 — a purpose-made
// 1200x630 og image is a future nicety, this is a placeholder using the real brand asset.
const OG_IMAGE_URL = "https://peacheslounge.com/brand/logo-stacked.png";

export const metadata: Metadata = {
  title: "Peaches Lounge — Pilates, Yoga & Matcha Bar in West Vancouver",
  description: SITE_DESCRIPTION,
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "Peaches Lounge — Pilates, Yoga & Matcha Bar in West Vancouver",
    description: SITE_DESCRIPTION,
    url: "https://peacheslounge.com",
    siteName: "Peaches Lounge",
    locale: "en_CA",
    type: "website",
    images: [
      { url: OG_IMAGE_URL, width: 2048, height: 2048, alt: "Peaches Lounge" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Peaches Lounge — Pilates, Yoga & Matcha Bar in West Vancouver",
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE_URL],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#efeff2" },
    { media: "(prefers-color-scheme: dark)", color: "#181818" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${geistMono.variable} ${sacramento.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Dark mode is class-based (`.dark` on <html>) so pages can override
            it, but every page must still follow the OS preference on direct
            load. Runs before paint to avoid a light flash in dark mode. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var m=window.matchMedia("(prefers-color-scheme: dark)");function s(){document.documentElement.classList.toggle("dark",m.matches)}s();m.addEventListener("change",s)})()`,
          }}
        />
        <BrandSplash />
        {children}
      </body>
    </html>
  );
}
