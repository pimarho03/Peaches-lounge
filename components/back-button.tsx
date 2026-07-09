import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";

/**
 * Consistent "back" affordance for every page. Uses an explicit href (not
 * browser history) so it still works when the page was reached via a direct
 * link — magic links, reset links, a bookmarked dashboard.
 */
export function BackButton({
  href,
  label = "Back",
}: {
  href: string;
  label?: string;
}) {
  return (
    <Link
      href={href}
      className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-sm font-medium transition-colors"
    >
      <ArrowLeft className="size-4" weight="bold" />
      {label}
    </Link>
  );
}
