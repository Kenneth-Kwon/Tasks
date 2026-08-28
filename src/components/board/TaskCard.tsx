"use client";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format, isPast, isToday } from "date-fns";
import { ko } from "date-fns/locale";
import { MoreHorizontal, Pencil, Trash2, CheckCircle2, Circle, GripVertical, AlignLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Quadrant, TaskWithMeta } from "@/types";

interface TaskCardProps {
  task: TaskWithMeta;
  quadrant?: Quadrant;
  onEdit: (task: TaskWithMeta) => void;
  onDelete: (id: string) => void;
  onStatusToggle: (id: string, status: "TODO" | "IN_PROGRESS" | "DONE") => void;
  /** 드래그 오버레이용 — true면 정적 렌더 */
  overlay?: boolean;
  simple?: boolean;
}

export function TaskCard({ task, quadrant, onEdit, onDelete, onStatusToggle, overlay, simple }: TaskCardProps) {
  const isDone = task.status === "DONE";
  const dueDateObj = task.dueDate ? new Date(task.dueDate) : null;
  const isOverdue = !!(dueDateObj && !Number.isNaN(dueDateObj.getTime()) && isPast(dueDateObj) && !isToday(dueDateObj) && !isDone);
  const hasValidDue = !!(dueDateObj && !Number.isNaN(dueDateObj.getTime()));

  const [menuOpen, setMenuOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const hasDescription = !!(task.description && task.description.trim());

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    disabled: overlay || isDone,
    data: { type: "task", quadrant },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const stopDrag = (e: PointerEvent) => e.stopPropagation();

  /* 카드 바깥 클릭 → 메뉴 닫기 */
  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [menuOpen]);

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      style={overlay ? undefined : style}
      className={cn(
        "rounded-lg border bg-white shadow-sm transition-shadow hover:shadow-md dark:bg-slate-900",
        simple ? "px-2 py-1.5" : "p-3",
        isDone && "opacity-60",
        "border-slate-200 dark:border-slate-700",
        isDragging && "opacity-30",
        !overlay && !isDone && "cursor-grab touch-none active:cursor-grabbing"
      )}
      {...(overlay || isDone ? {} : { ...attributes, ...listeners })}
    >
      <div ref={cardRef} className={cn("flex gap-2", simple ? "items-center" : "items-start")}>
        {!overlay && (
          <span
            className={cn("shrink-0 text-slate-300 dark:text-slate-600", !simple && "mt-0.5")}
            aria-hidden
          >
            <GripVertical className="h-4 w-4" />
          </span>
        )}

        {/* 완료 토글 */}
        <button
          type="button"
          onPointerDown={stopDrag}
          onClick={() => onStatusToggle(task.id, isDone ? "TODO" : "DONE")}
          className={cn("shrink-0 cursor-pointer text-slate-400 hover:text-blue-600 transition-colors", !simple && "mt-0.5")}
          title={isDone ? "미완료로 변경" : "완료 처리"}
        >
          {isDone ? <CheckCircle2 className="h-4 w-4 text-blue-500" /> : <Circle className="h-4 w-4" />}
        </button>

        {/* 내용 */}
        <div className="min-w-0 flex-1">
          {simple ? (
            <div className="flex min-w-0 items-center gap-1">
              <button
                type="button"
                onPointerDown={stopDrag}
                onClick={() => {
                  if (hasDescription) setExpanded((v) => !v);
                }}
                className={cn(
                  "min-w-0 flex-1 truncate text-left text-sm font-medium leading-tight",
                  hasDescription && "cursor-pointer",
                  isDone && "line-through text-slate-400"
                )}
              >
                {task.title}
              </button>
              {hasDescription && (
                <button
                  type="button"
                  onPointerDown={stopDrag}
                  onClick={() => setExpanded((v) => !v)}
                  className="shrink-0 cursor-pointer text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                  title="설명 보기"
                  aria-label={expanded ? "설명 접기" : "설명 보기"}
                  aria-expanded={expanded}
                >
                  <AlignLeft className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ) : (
          <p className={cn("text-sm font-medium leading-tight", isDone && "line-through text-slate-400")}>
            {task.title}
          </p>
          )}
          {!simple && task.description && (
            <p className="mt-0.5 truncate text-xs text-slate-500">{task.description}</p>
          )}
          {!simple && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              중요 {task.importanceScore}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              긴급 {task.urgencyScore}
            </span>
            {hasValidDue && dueDateObj && (
              <span className={cn(
                "rounded-full px-2 py-0.5 text-xs",
                isOverdue
                  ? "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300"
                  : isToday(dueDateObj)
                  ? "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300"
                  : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
              )}>
                {isOverdue ? "⚠ 기한 초과" : isToday(dueDateObj) ? "오늘 마감" : format(dueDateObj, "M/d (eee)", { locale: ko })}
              </span>
            )}
          </div>
          )}
        </div>

        {/* ... 버튼 */}
        <button
          type="button"
          aria-label="작업 메뉴"
          onPointerDown={stopDrag}
          onClick={() => setMenuOpen((v) => !v)}
          className="shrink-0 cursor-pointer rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>

      {simple && expanded && hasDescription && (
        <p className="mt-1.5 whitespace-pre-wrap break-words px-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          {task.description}
        </p>
      )}

      {/* 인라인 메뉴 */}
      {menuOpen && (
        <div className="mt-2 flex gap-2 border-t border-slate-100 pt-2 dark:border-slate-800">
          <button
            type="button"
            onPointerDown={stopDrag}
            onClick={() => { setMenuOpen(false); onEdit(task); }}
            className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md bg-slate-100 px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <Pencil className="h-3.5 w-3.5" /> 수정
          </button>
          <button
            type="button"
            onPointerDown={stopDrag}
            onClick={() => { setMenuOpen(false); onDelete(task.id); }}
            className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md bg-red-50 px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-950/70"
          >
            <Trash2 className="h-3.5 w-3.5" /> 삭제
          </button>
        </div>
      )}
    </div>
  );
}
