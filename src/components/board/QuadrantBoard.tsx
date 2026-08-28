"use client";
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  closestCorners,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Plus, Trash2 } from "lucide-react";
import { QuadrantColumn } from "./QuadrantColumn";
import { TaskCard } from "./TaskCard";
import { TaskModal } from "@/components/task/TaskModal";
import { ScoreWidget } from "./ScoreWidget";
import { SyncButton } from "./SyncButton";
import { SettingsModal } from "./SettingsModal";
import { useSettings } from "@/hooks/useSettings";
import { calcPriorityRank } from "@/lib/quadrant";
import { scoresForInsert, quadrantOfTask, sortOrderBetween, clampToQuadrant } from "@/lib/drag-scores";
import { isSubCellId, parseSubCellId, plotToScores, scoresForSubCell, taskToSubCell } from "@/lib/plot-position";
import { useViewMode } from "@/hooks/useViewMode";
import type { TaskWithMeta, Quadrant } from "@/types";

const AUTO_SYNC_INTERVAL = 15 * 60 * 1000;
const QUADRANTS: Quadrant[] = ["Q1", "Q2", "Q3", "Q4"];

function isQuadrantId(id: string): id is Quadrant {
  return QUADRANTS.includes(id as Quadrant);
}

function droppableQuadrant(args: Parameters<CollisionDetection>[0], id: string): Quadrant | undefined {
  const container = args.droppableContainers.find((item) => String(item.id) === id);
  const data = container?.data.current as
    | { type?: string; quadrant?: Quadrant }
    | undefined;
  return data?.quadrant;
}

function createCollisionDetection(isMatrix: boolean): CollisionDetection {
  return (args) => {
    const pointerHits = pointerWithin(args).filter((hit) => hit.id !== args.active.id);
    const subcells = pointerHits.filter((hit) => isSubCellId(String(hit.id)));
    const columns = pointerHits.filter((hit) => isQuadrantId(String(hit.id)));
    const tasks = pointerHits.filter(
      (hit) => !isQuadrantId(String(hit.id)) && !isSubCellId(String(hit.id))
    );

    if (isMatrix && subcells.length > 0) return [subcells[0]];

    if (columns.length > 0) {
      if (isMatrix) return [columns[0]];
      const columnId = String(columns[0].id) as Quadrant;
      const taskInColumn = tasks.find((hit) => droppableQuadrant(args, String(hit.id)) === columnId);
      return [taskInColumn ?? columns[0]];
    }

    if (tasks.length > 0) return [tasks[0]];

    const columnContainers = args.droppableContainers.filter((container) =>
      isQuadrantId(String(container.id))
    );
    return closestCorners({ ...args, droppableContainers: columnContainers });
  };
}

interface QuadrantBoardProps {
  initialTasks: TaskWithMeta[];
}

export function QuadrantBoard({ initialTasks }: QuadrantBoardProps) {
  const [tasks, setTasks] = useState<TaskWithMeta[]>(initialTasks);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskWithMeta | null>(null);
  const [activeTask, setActiveTask] = useState<TaskWithMeta | null>(null);
  const { settings, save: saveSettings } = useSettings();
  const { isSimple, isMatrix } = useViewMode();
  const lastOverRef = useRef<{ id: string; quadrant: Quadrant } | null>(null);
  const ignoreSyncUntilRef = useRef(0);
  const lastSyncRef = useRef<Date | null>(null);
  const plotRefs = useRef<Partial<Record<Quadrant, HTMLDivElement | null>>>({});
  const collisionDetection = useMemo(() => createCollisionDetection(isMatrix), [isMatrix]);

  const quadrantOrder: Quadrant[] = ["Q2", "Q1", "Q4", "Q3"];

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } })
  );

  const tasksByQuadrant = useCallback(
    (q: Quadrant) =>
      tasks
        .filter((t) => quadrantOfTask(t, settings) === q)
        // sortOrder DESC → 높은 값이 위에 표시됨. 같으면 priorityRank 기준
        .sort((a, b) =>
          b.sortOrder !== a.sortOrder
            ? b.sortOrder - a.sortOrder
            : calcPriorityRank(b.importanceScore, b.urgencyScore) -
              calcPriorityRank(a.importanceScore, a.urgencyScore)
        ),
    [tasks, settings]
  );

  function handleDragStart({ active }: DragStartEvent) {
    const t = tasks.find((t) => t.id === active.id);
    setActiveTask(t ?? null);
    // task ID가 아닌 소속 사분면 ID로 초기화: over가 null일 때 home quadrant에 drop으로 처리됨.
    // task ID로 초기화하면 active.id === overId → 즉시 early return(snap-back) 발생.
    if (t) {
      const q = quadrantOfTask(t, settings);
      lastOverRef.current = { id: q, quadrant: q };
    } else {
      lastOverRef.current = null;
    }
  }

  function handleDragOver({ over }: DragOverEvent) {
    if (!over) return;
    const overId = String(over.id);
    const sub = parseSubCellId(overId);
    if (sub) {
      lastOverRef.current = { id: overId, quadrant: sub.quadrant };
      return;
    }
    if (isQuadrantId(overId)) {
      lastOverRef.current = { id: overId, quadrant: overId };
      return;
    }
    const q = droppableQuadrantFromOver(overId);
    if (q) lastOverRef.current = { id: overId, quadrant: q };
  }

  function droppableQuadrantFromOver(overId: string): Quadrant | undefined {
    const overTask = tasks.find((t) => t.id === overId);
    return overTask ? quadrantOfTask(overTask, settings) : undefined;
  }

  function persistTask(dragged: TaskWithMeta, patch: Partial<TaskWithMeta>) {
    ignoreSyncUntilRef.current = Date.now() + 15_000;
    setTasks((prev) => prev.map((t) => (t.id === dragged.id ? { ...t, ...patch } : t)));
    fetch(`/api/tasks/${dragged.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((updated: TaskWithMeta | null) => {
        if (updated) {
          setTasks((prev) =>
            prev.map((t) => (t.id === updated.id ? { ...t, ...updated, ...patch } : t))
          );
        }
      })
      .catch(() => {
        setTasks((prev) => prev.map((t) => (t.id === dragged.id ? dragged : t)));
      });
  }

  function scoresFromPlotDrop(quadrant: Quadrant, active: DragEndEvent["active"]) {
    const el = plotRefs.current[quadrant];
    const rect = active.rect.current.translated ?? active.rect.current.initial;
    if (!el || !rect) return null;
    const box = el.getBoundingClientRect();
    if (box.width < 8 || box.height < 8) return null;
    const x = (rect.left + rect.width / 2 - box.left) / box.width;
    const y = 1 - (rect.top + rect.height / 2 - box.top) / box.height;
    return plotToScores(x, y, quadrant, settings);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveTask(null);
    const fallback = lastOverRef.current;
    const overId = over ? String(over.id) : fallback?.id;
    lastOverRef.current = null;

    const dragged = tasks.find((t) => t.id === active.id);
    if (!dragged) return;

    if (isMatrix) {
      const sub = parseSubCellId(overId ?? "");
      const overTask = overId && !sub && !isQuadrantId(overId)
        ? tasks.find((t) => t.id === overId) ?? null
        : null;

      const targetQuadrant = sub?.quadrant
        ?? (isQuadrantId(overId ?? "") ? (overId as Quadrant) : undefined)
        ?? (overTask ? quadrantOfTask(overTask, settings) : undefined)
        ?? fallback?.quadrant;
      if (!targetQuadrant) return;

      const targetCell = sub?.cell
        ?? (overTask ? taskToSubCell(overTask, targetQuadrant, settings) : undefined);

      const next = targetCell
        ? scoresForSubCell(targetQuadrant, targetCell, dragged, settings)
        : scoresFromPlotDrop(targetQuadrant, active)
          ?? clampToQuadrant(targetQuadrant, dragged.importanceScore, dragged.urgencyScore, settings);

      if (
        targetQuadrant === quadrantOfTask(dragged, settings) &&
        next.importanceScore === dragged.importanceScore &&
        next.urgencyScore === dragged.urgencyScore
      ) {
        return;
      }

      persistTask(dragged, { ...next, quadrant: targetQuadrant });
      return;
    }

    if (!overId || active.id === overId) return;

    const currentQuadrant = quadrantOfTask(dragged, settings);
    let targetQuadrant: Quadrant;
    let above: TaskWithMeta | null = null;
    let below: TaskWithMeta | null = null;

    if (isQuadrantId(overId)) {
      // 컬럼 배경에 드롭 → 해당 컬럼 맨 끝에 삽입
      targetQuadrant = overId;
      const col = tasksByQuadrant(targetQuadrant).filter((t) => t.id !== dragged.id);
      above = col[col.length - 1] ?? null;
    } else {
      const overTask = tasks.find((t) => t.id === overId);
      if (!overTask) return;

      targetQuadrant = quadrantOfTask(overTask, settings);
      const col = tasksByQuadrant(targetQuadrant).filter((t) => t.id !== dragged.id);
      const overIdx = col.findIndex((t) => t.id === overId);

      if (overIdx === -1) {
        above = col[col.length - 1] ?? null;
      } else {
        const activeRect = active.rect.current.translated ?? active.rect.current.initial;
        const insertAfter =
          over && activeRect
            ? activeRect.top + activeRect.height / 2 > over.rect.top + over.rect.height / 2
            : false;

        if (insertAfter) {
          above = col[overIdx] ?? null;
          below = col[overIdx + 1] ?? null;
        } else {
          above = col[overIdx - 1] ?? null;
          below = col[overIdx] ?? null;
        }
      }
    }

    // sortOrder는 항상 계산 (float 중간값이므로 무한 분할 가능 → snap-back 없음)
    const newSortOrder = sortOrderBetween(above, below, dragged);
    const isWithinQuadrant = targetQuadrant === currentQuadrant;

    if (isWithinQuadrant) {
      // ── 같은 사분면 내 재정렬: sortOrder만 변경 ──────────────────────────────
      // importanceScore/urgencyScore를 건드리지 않으므로 사분면 이탈 없음
      if (newSortOrder === dragged.sortOrder) return; // 유일한 task이거나 동일 위치

      ignoreSyncUntilRef.current = Date.now() + 15_000;
      setTasks((prev) =>
        prev.map((t) => (t.id === dragged.id ? { ...t, sortOrder: newSortOrder } : t))
      );
      fetch(`/api/tasks/${dragged.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: newSortOrder }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => {
          setTasks((prev) => prev.map((t) => (t.id === dragged.id ? dragged : t)));
        });
    } else {
      // ── 사분면 이동: importanceScore/urgencyScore + sortOrder 변경 ──────────
      const { importanceScore, urgencyScore } = scoresForInsert(
        targetQuadrant,
        above,
        below,
        dragged,
        settings,
        false // cross-quadrant: urgency도 target bounds에 clamp
      );
      const quadrant = targetQuadrant;

      ignoreSyncUntilRef.current = Date.now() + 15_000;
      setTasks((prev) =>
        prev.map((t) =>
          t.id === dragged.id
            ? { ...t, importanceScore, urgencyScore, quadrant, sortOrder: newSortOrder }
            : t
        )
      );
      fetch(`/api/tasks/${dragged.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ importanceScore, urgencyScore, sortOrder: newSortOrder }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((updated: TaskWithMeta | null) => {
          if (updated) {
            setTasks((prev) =>
              prev.map((t) =>
                t.id === updated.id
                  ? { ...t, ...updated, importanceScore, urgencyScore, quadrant, sortOrder: newSortOrder }
                  : t
              )
            );
          }
        })
        .catch(() => {
          setTasks((prev) => prev.map((t) => (t.id === dragged.id ? dragged : t)));
        });
    }
  }

  const handleAdd = useCallback(() => { setEditingTask(null); setModalOpen(true); }, []);
  const handleEdit = useCallback((task: TaskWithMeta) => { setEditingTask(task); setModalOpen(true); }, []);

  const handleSave = async (data: {
    title: string; description: string; importanceScore: number; urgencyScore: number; dueDate: string | null; googleListId?: string | null;
  }) => {
    if (editingTask) {
      const res = await fetch(`/api/tasks/${editingTask.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
      });
      if (res.ok) {
        const updated: TaskWithMeta = await res.json();
        setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      }
    } else {
      const res = await fetch("/api/tasks", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
      });
      if (res.ok) {
        const created: TaskWithMeta & { googleError?: string } = await res.json();
        setTasks((prev) => [...prev, created]);
        if (created.googleError) alert(created.googleError);
      }
    }
  };

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm("Task를 삭제할까요?")) return;
    const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    if (res.ok) setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleStatusToggle = useCallback(async (id: string, status: "TODO" | "IN_PROGRESS" | "DONE") => {
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const updated: TaskWithMeta = await res.json();
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    }
  }, []);

  const handleSynced = useCallback(async (opts?: { force?: boolean }) => {
    if (!opts?.force && Date.now() < ignoreSyncUntilRef.current) return;
    const res = await fetch("/api/tasks");
    if (res.ok) setTasks(await res.json());
  }, []);

  const handleClearDone = useCallback(async () => {
    if (!confirm("완료된 Task를 모두 삭제할까요?")) return;
    const res = await fetch("/api/tasks/done", { method: "DELETE" });
    if (res.ok) setTasks((prev) => prev.filter((t) => t.status !== "DONE"));
  }, []);

  useEffect(() => {
    const runSync = async () => {
      try {
        const res = await fetch("/api/tasks/sync-google", { method: "POST" });
        if (res.ok) {
          lastSyncRef.current = new Date();
          await new Promise((r) => setTimeout(r, 1000));
          await handleSynced();
        }
      } catch { /* 자동 동기화 실패 무시 */ }
    };

    const initialDelay = setTimeout(runSync, 3000);
    const timer = setInterval(runSync, AUTO_SYNC_INTERVAL);
    return () => { clearTimeout(initialDelay); clearInterval(timer); };
  }, [handleSynced]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className={isSimple ? "flex min-h-0 flex-1 flex-col" : undefined}>
      <div className={isSimple ? "mb-2 shrink-0" : "mb-4"}>
        <ScoreWidget tasks={tasks} compact={isSimple} />
      </div>

      <div className={isSimple ? "mb-2 flex shrink-0 flex-wrap items-center justify-between gap-2" : "mb-4 flex flex-wrap items-center justify-between gap-2"}>
        <div className="flex flex-wrap items-center gap-2">
          <SyncButton onSynced={handleSynced} />
          <SettingsModal settings={settings} onSave={saveSettings} />
          {tasks.some((t) => t.status === "DONE") && (
            <button
              onClick={handleClearDone}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/50 transition-all"
            >
              <Trash2 className="h-3.5 w-3.5" />
              완료건 초기화
            </button>
          )}
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 active:scale-[0.98] transition-all dark:bg-slate-50 dark:text-slate-900 dark:hover:bg-slate-200"
        >
          <Plus className="h-4 w-4" />
          새 Task 추가
        </button>
      </div>

      {/* Simple 모드: X/Y축 레이블 포함 레이아웃 */}
      {isSimple ? (
        <div className="flex min-h-0 flex-1 gap-2">
          {/* Y축 — 중요도 (세로) */}
          <div className="flex w-10 shrink-0 flex-col items-center py-0.5">
            {/* 위 화살촉: Q1(red)+Q2(blue) → 중요 */}
            <svg width="20" height="14" viewBox="0 0 20 14" className="shrink-0">
              <defs>
                <linearGradient id="yTopGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#ef4444" />
                </linearGradient>
              </defs>
              <polygon points="0,14 20,14 10,0" fill="url(#yTopGrad)" />
            </svg>
            <span className="mt-0.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400 select-none">높음</span>
            {/* 세로 막대 (그라데이션) + 레이블 */}
            <div className="relative flex flex-1 w-full items-center justify-center">
              <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="yBarGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="50%" stopColor="#a855f7" />
                    <stop offset="100%" stopColor="#9ca3af" />
                  </linearGradient>
                </defs>
                <rect x="50%" y="0" width="8" height="100%" transform="translate(-4,0)" rx="4" fill="url(#yBarGrad)" />
              </svg>
              <span
                className="relative select-none bg-slate-50 px-2 py-1 text-sm font-bold text-slate-700 dark:bg-slate-950 dark:text-slate-200"
                style={{ transform: "rotate(-90deg)", whiteSpace: "nowrap" }}
              >
                중요도
              </span>
            </div>
            <span className="mb-0.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400 select-none">낮음</span>
            {/* 아래 화살촉: Q3(amber)+Q4(gray) → 비중요 */}
            <svg width="20" height="14" viewBox="0 0 20 14" className="shrink-0">
              <defs>
                <linearGradient id="yBotGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#9ca3af" />
                  <stop offset="100%" stopColor="#f59e0b" />
                </linearGradient>
              </defs>
              <polygon points="0,0 20,0 10,14" fill="url(#yBotGrad)" />
            </svg>
          </div>

          {/* 오른쪽: X축 + 그리드 */}
          <div className="flex min-h-0 flex-1 flex-col gap-2">
            {/* X축 — 시급성 (가로) */}
            <div className="flex shrink-0 items-center py-0.5">
              <span className="mr-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400 select-none">낮음</span>
              {/* 왼쪽 화살촉: Q2(blue)+Q4(gray) → 비긴급 */}
              <svg width="14" height="20" viewBox="0 0 14 20" className="shrink-0">
                <defs>
                  <linearGradient id="xLeftGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#9ca3af" />
                  </linearGradient>
                </defs>
                <polygon points="14,0 14,20 0,10" fill="url(#xLeftGrad)" />
              </svg>
              {/* 가로 막대 (그라데이션) + 레이블 */}
              <div className="relative flex flex-1 items-center justify-center">
                <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="xBarGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#6b7280" />
                      <stop offset="50%" stopColor="#f59e0b" />
                      <stop offset="100%" stopColor="#ef4444" />
                    </linearGradient>
                  </defs>
                  <rect x="0" y="50%" width="100%" height="8" transform="translate(0,-4)" rx="4" fill="url(#xBarGrad)" />
                </svg>
                <span className="relative select-none bg-slate-50 px-2 text-sm font-bold text-slate-700 dark:bg-slate-950 dark:text-slate-200">
                  시급성
                </span>
              </div>
              {/* 오른쪽 화살촉: Q1(red)+Q3(amber) → 긴급 */}
              <svg width="14" height="20" viewBox="0 0 14 20" className="shrink-0">
                <defs>
                  <linearGradient id="xRightGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" />
                    <stop offset="100%" stopColor="#f59e0b" />
                  </linearGradient>
                </defs>
                <polygon points="0,0 0,20 14,10" fill="url(#xRightGrad)" />
              </svg>
              <span className="ml-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400 select-none">높음</span>
            </div>

            {/* 4사분면 그리드 */}
            <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-2">
              {quadrantOrder.map((q) => (
                <QuadrantColumn
                  key={q}
                  quadrant={q}
                  tasks={tasksByQuadrant(q)}
                  settings={settings}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onStatusToggle={handleStatusToggle}
                  simple={isSimple}
                  matrix={isMatrix}
                  onPlotRef={(el) => { plotRefs.current[q] = el; }}
                />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {quadrantOrder.map((q) => (
            <QuadrantColumn
              key={q}
              quadrant={q}
              tasks={tasksByQuadrant(q)}
              settings={settings}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onStatusToggle={handleStatusToggle}
              simple={isSimple}
              matrix={isMatrix}
              onPlotRef={(el) => { plotRefs.current[q] = el; }}
            />
          ))}
        </div>
      )}
      </div>

      {/* 드래그 중 떠다니는 카드 미리보기 */}
      <DragOverlay>
        {activeTask && (
          <div className="rotate-1 opacity-95 shadow-2xl">
            <TaskCard
              task={activeTask}
              onEdit={() => {}}
              onDelete={() => {}}
              onStatusToggle={() => {}}
              overlay
              simple={isSimple || isMatrix}
            />
          </div>
        )}
      </DragOverlay>

      <TaskModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingTask(null); }}
        onSave={handleSave}
        task={editingTask}
      />
    </DndContext>
  );
}
