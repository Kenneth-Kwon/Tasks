"use client";
import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ChevronDown, ChevronRight } from "lucide-react";
import { TaskCard } from "./TaskCard";
import { QUADRANT_META } from "@/lib/quadrant";
import type { TaskWithMeta, Quadrant } from "@/types";

interface QuadrantColumnProps {
  quadrant: Quadrant;
  tasks: TaskWithMeta[];
  onEdit: (task: TaskWithMeta) => void;
  onDelete: (id: string) => void;
  onStatusToggle: (id: string, status: "TODO" | "IN_PROGRESS" | "DONE") => void;
  simple?: boolean;
}

export function QuadrantColumn({ quadrant, tasks, onEdit, onDelete, onStatusToggle, simple }: QuadrantColumnProps) {
  const meta = QUADRANT_META[quadrant];
  const pending = tasks.filter((t) => t.status !== "DONE");
  const done = tasks.filter((t) => t.status === "DONE");
  const [showDone, setShowDone] = useState(false);

  const { setNodeRef, isOver } = useDroppable({
    id: quadrant,
    data: { type: "column", quadrant },
  });

  const pendingIds = pending.map((t) => t.id);

  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-0 flex-col rounded-xl border-2 ${meta.borderColor} ${meta.bgColor} transition-colors ${simple ? "h-full overflow-hidden" : "min-h-[300px]"} ${isOver ? "ring-2 ring-blue-400 ring-offset-1" : ""}`}
    >
      {/* 헤더 */}
      <div className={`flex shrink-0 items-center gap-2 border-b border-slate-200/60 dark:border-slate-700/60 ${simple ? "px-3 py-2" : "px-4 py-3"}`}>
        <div className={`h-3 w-3 rounded-full ${meta.dotColor} shrink-0`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-semibold">{quadrant}</span>
            <span className="text-sm font-medium truncate">{meta.label}</span>
          </div>
          {!simple && <p className="text-xs text-slate-500">{meta.sub} · {meta.desc}</p>}
        </div>
        <span className={`shrink-0 text-xs font-semibold rounded-full px-2 py-0.5 ${meta.badgeColor}`}>
          {pending.length}
        </span>
      </div>

      {/* Task 목록 */}
      <div className={`flex min-h-0 flex-1 flex-col gap-2 px-3 py-3 ${simple ? "overflow-y-auto" : ""}`}>
        {pending.length === 0 && done.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-slate-400">
            <p className="text-xs">Task가 없습니다</p>
          </div>
        )}

        <SortableContext items={pendingIds} strategy={verticalListSortingStrategy}>
          {pending.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              quadrant={quadrant}
              onEdit={onEdit}
              onDelete={onDelete}
              onStatusToggle={onStatusToggle}
              simple={simple}
            />
          ))}
        </SortableContext>

        {done.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => setShowDone((v) => !v)}
              className="flex w-full items-center gap-2 pt-1 text-left"
            >
              <div className="flex-1 border-t border-slate-200 dark:border-slate-700" />
              <span className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                {showDone ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                완료 {done.length}건
              </span>
              <div className="flex-1 border-t border-slate-200 dark:border-slate-700" />
            </button>
            {showDone && done.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                quadrant={quadrant}
                onEdit={onEdit}
                onDelete={onDelete}
                onStatusToggle={onStatusToggle}
                simple={simple}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
