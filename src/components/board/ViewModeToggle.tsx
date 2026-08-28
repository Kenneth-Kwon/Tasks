"use client";
import { LayoutGrid, List } from "lucide-react";
import { useViewMode } from "@/hooks/useViewMode";

export function ViewModeToggle() {
  const { isSimple, toggle } = useViewMode();

  return (
    <button
      type="button"
      onClick={toggle}
      className="flex items-center gap-1 rounded-md px-1.5 py-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors"
      title={isSimple ? "Detail 모드로 전환" : "Simple 모드로 전환"}
    >
      {isSimple ? <List className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
      <span className="hidden text-xs font-medium sm:inline">{isSimple ? "Simple" : "Detail"}</span>
    </button>
  );
}
