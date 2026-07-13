import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * Script wordmark "logo" — reuses the Sacramento script font from the splash
 * screen so the header reads as a signature rather than plain UI text.
 * Owner will supply a real logo image later; keeping this as its own
 * component means swapping to <Image> is a one-file change.
 */
export function BrandWordmark({ className }: { className?: string }) {
  return (
    <Link href="/" aria-label="Peaches Lounge" className="inline-flex">
      <span
        className={cn("text-3xl leading-none", className)}
        // Rose-gold from the brand logo — placeholder tint until the real
        // logo image lands in /public and this swaps to an <Image>.
        style={{ fontFamily: "var(--font-script)", color: "#c98d76" }}
      >
        Peaches Lounge
      </span>
    </Link>
  );
}
