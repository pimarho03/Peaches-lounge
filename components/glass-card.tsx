import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Apple-style "liquid glass" surface — web port of the booking app's
 * components/GlassCard.tsx. Blurred backdrop + translucent tint + a bright
 * top-edge highlight + hairline border. Fully rounded, no sharp corners.
 */
function GlassCard({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="glass-card"
      className={cn(
        "glass overflow-hidden rounded-3xl p-6 text-card-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export { GlassCard };
