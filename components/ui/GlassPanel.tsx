import type { PropsWithChildren } from "react";
import { cn } from "@/src/lib/utils";

export function GlassPanel({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <section className={cn("glass section-card", className)}>{children}</section>;
}
