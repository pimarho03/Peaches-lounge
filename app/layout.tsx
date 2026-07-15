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

// Cursive script used only for the handwriting splash wordmark.
const sacramento = Sacramento({
  variable: "--font-script",
  subsets: ["latin"],
  weight: "400",
});

const SITE_DESCRIPTION =
  "Peaches Lounge is a reformer Pilates, yoga, and matcha bar in West Vancouver — a calm, curved little world built for genuine community, not just a workout.";

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
