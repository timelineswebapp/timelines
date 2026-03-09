import type { ReactNode } from "react";
import { cn } from "@/src/lib/utils";

const statusClassMap: Record<string, string> = {
  pending: "rgba(201, 138, 22, 0.16)",
  planned: "rgba(79, 143, 201, 0.16)",
  reviewed: "rgba(15, 141, 99, 0.16)",
  rejected: "rgba(200, 83, 83, 0.16)",
  completed: "rgba(15, 141, 99, 0.16)"
};

export function StatusPill({ children, status }: { children: ReactNode; status?: string }) {
  return (
    <span
      className={cn("pill")}
      style={{ background: status ? statusClassMap[status] || "rgba(19, 32, 51, 0.06)" : "rgba(19, 32, 51, 0.06)" }}
    >
      {children}
    </span>
  );
}
