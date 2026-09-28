"use client";
import { useEffect, useRef, useState, type FormEvent, type PointerEvent } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format, isPast, isToday } from "date-fns";
import { ko } from "date-fns/locale";
import { MoreHorizontal, Pencil, Plus, Trash2, CheckCircle2, Circle, GripVertical, AlignLeft, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Quadrant, TaskWithMeta } from "@/types";

interface TaskCardProps {
  task: TaskWithMeta;
  quadrant?: Quadrant;
  children?: TaskWithMeta[];
  onEdit: (task: TaskWithMeta) => void;
  onDelete: (id: string) => void;
  onStatusToggle: (id: string, status: "TODO" | "IN_PROGRESS" | "DONE") => void | Promise<void>;
  onAddChild?: (parentId: string, title: string) => void | Promise<void>;
  googleListTitle?: string | null;
  /** 드래그 오버레이용 — true면 정적 렌더 */
  overlay?: boolean;
  simple?: boolean;
}

function GoogleListChip({ title }: { title: string }) {
  return (
    <span
      title={title}
      className="inline-block max-w-[6.5rem] shrink-0 truncate whitespace-nowrap rounded bg-slate-100 px-1.5 py-px text-[10px] leading-4 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
    >
      {title}
    </span>
  );
}

function StatusIcon({
  isDone,
  pending,
}: {
  isDone: boolean;
  pending: boolean;
}) {
  if (pending) return <Loader2 className="h-4 w-4 animate-spin" />;
  if (isDone) return <CheckCircle2 className="h-4 w-4 text-blue-500" />;
  return <Circle className="h-4 w-4" />;
}

function SubtaskRow({
  task,
  overlay,
  onEdit,
  onDelete,
  onStatusToggle,
}: {
  task: TaskWithMeta;
  overlay?: boolean;
  onEdit: (task: TaskWithMeta) => void;
  onDelete: (id: string) => void;
  onStatusToggle: (id: string, status: "TODO" | "IN_PROGRESS" | "DONE") => void | Promise<void>;
}) {
  const isDone = task.status === "DONE";
  const [pending, setPending] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleComplete() {
    if (pending || overlay) return;
    setPending(true);
    try {
      await onStatusToggle(task.id, isDone ? "TODO" : "DONE");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="group/sub flex flex-col">
      <div className="flex items-center gap-1.5 py-0.5">
        <button
          type="button"
          onClick={handleComplete}
          disabled={pending || overlay}
          aria-busy={pending}
          className={cn(
            "shrink-0 rounded-full p-0.5 transition-colors",
            pending ? "cursor-wait text-blue-500" : "cursor-pointer text-slate-400 hover:text-blue-600"
          )}
          title={pending ? (isDone ? "되돌리는 중" : "완료 중") : isDone ? "미완료로 변경" : "완료 처리"}
        >
          <StatusIcon isDone={isDone} pending={pending} />
        </button>
        <button
          type="button"
          onClick={handleComplete}
          disabled={pending || overlay}
          className={cn(
            "min-w-0 flex-1 truncate text-left text-sm leading-tight",
            pending && "cursor-wait",
            !pending && !overlay && "cursor-pointer",
            isDone && "text-slate-400 line-through"
          )}
        >
          {task.title}
        </button>
        {!overlay && (
          <button
            type="button"
            aria-label="하위 할일 메뉴"
            onClick={() => setMenuOpen((v) => !v)}
            className="shrink-0 cursor-pointer rounded p-0.5 text-slate-400 opacity-0 hover:bg-slate-100 hover:text-slate-600 group-hover/sub:opacity-100 dark:hover:bg-slate-800"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {menuOpen && !overlay && (
        <div className="mb-1 ml-6 flex gap-1">
          <button
            type="button"
            onClick={() => { setMenuOpen(false); onEdit(task); }}
            className="flex flex-1 cursor-pointer items-center justify-center gap-1 rounded bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
          >
            <Pencil className="h-3 w-3" /> 수정
          </button>
          <button
            type="button"
            onClick={() => { setMenuOpen(false); onDelete(task.id); }}
            className="flex flex-1 cursor-pointer items-center justify-center gap-1 rounded bg-red-50 px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-100 dark:bg-red-950/40"
          >
            <Trash2 className="h-3 w-3" /> 삭제
          </button>
        </div>
      )}
    </div>
  );
}

function AddSubtaskForm({
  parentId,
  onAddChild,
  onClose,
}: {
  parentId: string;
  onAddChild: (parentId: string, title: string) => void | Promise<void>;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next = title.trim();
    if (!next || saving) return;
    setSaving(true);
    try {
      await onAddChild(parentId, next);
      setTitle("");
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-1 py-0.5">
      <Circle className="h-4 w-4 shrink-0 text-slate-300" />
      <input
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => { if (!title.trim() && !saving) onClose(); }}
        placeholder="하위 할일"
        disabled={saving}
        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
      />
    </form>
  );
}

export function TaskCard({
  task,
  quadrant,
  children = [],
  onEdit,
  onDelete,
  onStatusToggle,
  onAddChild,
  googleListTitle,
  overlay,
  simple,
}: TaskCardProps) {
  const isDone = task.status === "DONE";
  const dueDateObj = task.dueDate ? new Date(task.dueDate) : null;
  const isOverdue = !!(dueDateObj && !Number.isNaN(dueDateObj.getTime()) && isPast(dueDateObj) && !isToday(dueDateObj) && !isDone);
  const hasValidDue = !!(dueDateObj && !Number.isNaN(dueDateObj.getTime()));

  const [menuOpen, setMenuOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [childrenOpen, setChildrenOpen] = useState(false);
  const [addingChild, setAddingChild] = useState(false);
  const [statusPending, setStatusPending] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const hasDescription = !!(task.description && task.description.trim());
  const canAddChild = !overlay && !isDone && !!onAddChild;
  const showChildren = childrenOpen && children.length > 0;

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

  async function handleStatusClick() {
    if (statusPending || overlay) return;
    setStatusPending(true);
    try {
      await onStatusToggle(task.id, isDone ? "TODO" : "DONE");
    } finally {
      setStatusPending(false);
    }
  }

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
        statusPending && "opacity-70",
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
          onClick={handleStatusClick}
          disabled={statusPending}
          aria-busy={statusPending}
          className={cn(
            "shrink-0 transition-colors",
            !simple && "mt-0.5",
            statusPending
              ? "cursor-wait text-blue-500"
              : "cursor-pointer text-slate-400 hover:text-blue-600"
          )}
          title={statusPending ? (isDone ? "되돌리는 중" : "완료 중") : isDone ? "미완료로 변경" : "완료 처리"}
        >
          {statusPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isDone ? (
            <CheckCircle2 className="h-4 w-4 text-blue-500" />
          ) : (
            <Circle className="h-4 w-4" />
          )}
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
              {googleListTitle && <GoogleListChip title={googleListTitle} />}
              {statusPending && (
                <span className="shrink-0 text-[10px] font-medium text-blue-500">
                  {isDone ? "되돌리는 중" : "완료 중"}
                </span>
              )}
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
          <div className="flex min-w-0 items-center gap-1.5">
            <p className={cn("min-w-0 truncate text-sm font-medium leading-tight", isDone && "line-through text-slate-400")}>
              {task.title}
            </p>
            {googleListTitle && <GoogleListChip title={googleListTitle} />}
          </div>
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

        {canAddChild && (
          <button
            type="button"
            onPointerDown={stopDrag}
            onClick={() => {
              setAddingChild(true);
              setChildrenOpen(true);
            }}
            className="shrink-0 cursor-pointer rounded px-1.5 py-0.5 text-[11px] font-medium text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            title="하위 할일 추가"
          >
            + 하위 할일 추가
          </button>
        )}
        {children.length > 0 && (
          <button
            type="button"
            onPointerDown={stopDrag}
            onClick={() => setChildrenOpen((v) => !v)}
            className="flex shrink-0 cursor-pointer items-center gap-0.5 rounded px-1 py-0.5 text-[11px] text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-expanded={childrenOpen}
            title={childrenOpen ? "하위 할일 접기" : "하위 할일 펼치기"}
          >
            {childrenOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            하위 {children.length}
          </button>
        )}
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

      {(showChildren || addingChild) && (
        <div
          className="mt-1.5 ml-6 flex flex-col border-l border-slate-200 pl-2 dark:border-slate-700"
          onPointerDown={stopDrag}
        >
          {showChildren && children.map((child) => (
            <SubtaskRow
              key={child.id}
              task={child}
              overlay={overlay}
              onEdit={onEdit}
              onDelete={onDelete}
              onStatusToggle={onStatusToggle}
            />
          ))}
          {addingChild && onAddChild && (
            <AddSubtaskForm
              parentId={task.id}
              onAddChild={onAddChild}
              onClose={() => setAddingChild(false)}
            />
          )}
        </div>
      )}

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
