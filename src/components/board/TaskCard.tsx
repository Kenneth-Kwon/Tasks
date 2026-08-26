"use client";
import { useState, useRef } from "react";
import { format, isPast, isToday } from "date-fns";
import { ko } from "date-fns/locale";
import { MoreHorizontal, Pencil, Trash2, CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskWithMeta } from "@/types";

interface TaskCardProps {
  task: TaskWithMeta;
  onEdit: (task: TaskWithMeta) => void;
  onDelete: (id: string) => void;
  onStatusToggle: (id: string, status: "TODO" | "IN_PROGRESS" | "DONE") => void;
}

export function TaskCard({ task, onEdit, onDelete, onStatusToggle }: TaskCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const menuBtnRef = useRef<HTMLButtonElement>(null);

  const isDone = task.status === "DONE";
  const dueDateObj = task.dueDate ? new Date(task.dueDate) : null;
  const isOverdue = dueDateObj && isPast(dueDateObj) && !isToday(dueDateObj) && !isDone;

  function openMenu() {
    if (menuBtnRef.current) {
      const rect = menuBtnRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setMenuOpen(true);
  }

  return (
    <div
      className={cn(
        "group relative rounded-lg border bg-white p-3 shadow-sm transition-all hover:shadow-md dark:bg-slate-900",
        isDone && "opacity-60",
        "border-slate-200 dark:border-slate-700"
      )}
    >
      <div className="flex items-start gap-2">
        {/* 완료 토글 */}
        <button
          onClick={() => onStatusToggle(task.id, isDone ? "TODO" : "DONE")}
          className="mt-0.5 shrink-0 text-slate-400 hover:text-blue-600 transition-colors"
          title={isDone ? "미완료로 변경" : "완료 처리"}
        >
          {isDone ? (
            <CheckCircle2 className="h-4 w-4 text-blue-500" />
          ) : (
            <Circle className="h-4 w-4" />
          )}
        </button>

        {/* 내용 */}
        <div className="flex-1 min-w-0">
          <p className={cn("text-sm font-medium leading-tight", isDone && "line-through text-slate-400")}>
            {task.title}
          </p>
          {task.description && (
            <p className="mt-0.5 text-xs text-slate-500 truncate">{task.description}</p>
          )}

          {/* 메타 정보 */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-xs rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-slate-600 dark:text-slate-300">
              중요 {task.importanceScore}
            </span>
            <span className="text-xs rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-slate-600 dark:text-slate-300">
              긴급 {task.urgencyScore}
            </span>
            {dueDateObj && (
              <span
                className={cn(
                  "text-xs rounded-full px-2 py-0.5",
                  isOverdue
                    ? "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300"
                    : isToday(dueDateObj)
                    ? "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300"
                    : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                )}
              >
                {isOverdue ? "⚠ 기한 초과" : isToday(dueDateObj) ? "오늘 마감" : format(dueDateObj, "M/d (eee)", { locale: ko })}
              </span>
            )}
          </div>
        </div>

        {/* 메뉴 버튼 */}
        <button
          ref={menuBtnRef}
          onClick={openMenu}
          className="shrink-0 rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
        >
          <MoreHorizontal className="h-3.5 w-3.5 text-slate-500" />
        </button>
      </div>

      {/* 메뉴 팝업 — overflow 잘림 방지를 위해 fixed 사용 */}
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div
            className="fixed z-50 w-32 rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
            style={{ top: menuPos.top, right: menuPos.right }}
          >
            <button
              onClick={() => { setMenuOpen(false); onEdit(task); }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Pencil className="h-3.5 w-3.5" /> 수정
            </button>
            <button
              onClick={() => { setMenuOpen(false); onDelete(task.id); }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <Trash2 className="h-3.5 w-3.5" /> 삭제
            </button>
          </div>
        </>
      )}
    </div>
  );
}
