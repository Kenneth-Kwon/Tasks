"use client";
import type { ReactNode } from "react";
import { useViewMode } from "@/hooks/useViewMode";

export function ViewModeFrame({ children }: { children: ReactNode }) {
  const { isSimple } = useViewMode();

  return (
    <div
      className={
        isSimple
          ? "flex h-dvh flex-col overflow-hidden bg-slate-50 dark:bg-slate-950"
          : "min-h-screen bg-slate-50 dark:bg-slate-950"
      }
    >
      {children}
    </div>
  );
}
