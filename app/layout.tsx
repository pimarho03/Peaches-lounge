import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "Peaches Lounge — Pilates · Yoga · Matcha",
  description:
    "Book reformer Pilates, yoga, and meditation at Peaches Lounge. Community-first, premium, and calm.",
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
