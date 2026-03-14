import type * as React from "react";

import { cn } from "../../lib/utils";

export function SectionKicker({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn(
        "text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-muted",
        className,
      )}
      {...props}
    />
  );
}
