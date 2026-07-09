import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create your account — Peaches Lounge",
  description: "Create a Peaches Lounge account to book classes.",
};

/** Same forced-dark liquid-glass chrome as the sign-in surface. */
export default function SignupLayout({
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
