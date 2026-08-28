"use client";
import { List, LayoutDashboard } from "lucide-react";
import { useViewMode } from "@/hooks/useViewMode";

export function LayoutModeToggle() {
  const { isMatrix, toggleLayout } = useViewMode();

  return (
    <button
      type="button"
      onClick={toggleLayout}
      className="flex items-center gap-1 rounded-md px-1.5 py-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors"
      title={isMatrix ? "리스트 배치로 전환" : "2D 카드 배치로 전환"}
    >
      {isMatrix ? <LayoutDashboard className="h-4 w-4" /> : <List className="h-4 w-4" />}
      <span className="hidden text-xs font-medium sm:inline">{isMatrix ? "2D" : "리스트"}</span>
    </button>
  );
}
