"use client";
import { Plus } from "lucide-react";
import { TaskCard } from "./TaskCard";
import { QUADRANT_META } from "@/lib/quadrant";
import type { TaskWithMeta, Quadrant } from "@/types";

interface QuadrantColumnProps {
  quadrant: Quadrant;
  tasks: TaskWithMeta[];
  onAdd: (quadrant: Quadrant) => void;
  onEdit: (task: TaskWithMeta) => void;
  onDelete: (id: string) => void;
  onStatusToggle: (id: string, status: "TODO" | "IN_PROGRESS" | "DONE") => void;
}

export function QuadrantColumn({
  quadrant,
  tasks,
  onAdd,
  onEdit,
  onDelete,
  onStatusToggle,
}: QuadrantColumnProps) {
  const meta = QUADRANT_META[quadrant];
  const pending = tasks.filter((t) => t.status !== "DONE");
  const done = tasks.filter((t) => t.status === "DONE");

  return (
    <div className={`flex flex-col rounded-xl border-2 ${meta.borderColor} ${meta.bgColor} min-h-[300px]`}>
      {/* 헤더 */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200/60 dark:border-slate-700/60">
        <div className={`h-3 w-3 rounded-full ${meta.dotColor} shrink-0`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-semibold">{quadrant}</span>
            <span className="text-sm font-medium truncate">{meta.label}</span>
          </div>
          <p className="text-xs text-slate-500">{meta.sub} · {meta.desc}</p>
        </div>
        <span className={`shrink-0 text-xs font-semibold rounded-full px-2 py-0.5 ${meta.badgeColor}`}>
          {pending.length}
        </span>
      </div>

      {/* Task 목록 */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 max-h-[480px]">
        {pending.length === 0 && done.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-slate-400">
            <p className="text-xs">Task가 없습니다</p>
          </div>
        )}
        {pending.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onEdit={onEdit}
            onDelete={onDelete}
            onStatusToggle={onStatusToggle}
          />
        ))}
        {done.length > 0 && (
          <>
            <div className="flex items-center gap-2 pt-1">
              <div className="flex-1 border-t border-slate-200 dark:border-slate-700" />
              <span className="text-xs text-slate-400">완료 {done.length}</span>
              <div className="flex-1 border-t border-slate-200 dark:border-slate-700" />
            </div>
            {done.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onEdit={onEdit}
                onDelete={onDelete}
                onStatusToggle={onStatusToggle}
              />
            ))}
          </>
        )}
      </div>

      {/* 추가 버튼 */}
      <div className="px-3 py-2 border-t border-slate-200/60 dark:border-slate-700/60">
        <button
          onClick={() => onAdd(quadrant)}
          className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 hover:text-slate-700 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Task 추가
        </button>
      </div>
    </div>
  );
}
