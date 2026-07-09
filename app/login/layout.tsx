import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in — Peaches Lounge",
  description: "Sign in to book classes at Peaches Lounge.",
};

/**
 * The auth surface is app UI: black & white liquid glass on deep #111111
 * blacks (peachy/nude tones stay in marketing). Forced dark, no nav, no
 * banners — one goal, one focus.
 */
export default function LoginLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div
      className="dark flex min-h-dvh flex-col text-foreground"
      style={{
        background: "linear-gradient(160deg, #111111 0%, #18181a 100%)",
      }}
    >
      {children}
    </div>
  );
}
