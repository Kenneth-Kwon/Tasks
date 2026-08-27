"use client";
import { useState, useCallback, useEffect, useRef } from "react";
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
import { scoresForInsert, quadrantOfTask } from "@/lib/drag-scores";
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

/** 포인터가 올라간 사분면만 인정한다. 다른 사분면 카드가 드롭을 가로채지 않게 한다. */
const collisionDetection: CollisionDetection = (args) => {
  const pointerHits = pointerWithin(args).filter((hit) => hit.id !== args.active.id);
  const columns = pointerHits.filter((hit) => isQuadrantId(String(hit.id)));
  const tasks = pointerHits.filter((hit) => !isQuadrantId(String(hit.id)));

  if (columns.length > 0) {
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

interface QuadrantBoardProps {
  initialTasks: TaskWithMeta[];
}

export function QuadrantBoard({ initialTasks }: QuadrantBoardProps) {
  const [tasks, setTasks] = useState<TaskWithMeta[]>(initialTasks);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskWithMeta | null>(null);
  const [activeTask, setActiveTask] = useState<TaskWithMeta | null>(null);
  const { settings, save: saveSettings } = useSettings();
  const lastOverRef = useRef<{ id: string; quadrant: Quadrant } | null>(null);
  const ignoreSyncUntilRef = useRef(0);
  const lastSyncRef = useRef<Date | null>(null);

  const quadrantOrder: Quadrant[] = ["Q2", "Q1", "Q4", "Q3"];

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } })
  );

  const tasksByQuadrant = useCallback(
    (q: Quadrant) =>
      tasks
        .filter((t) => quadrantOfTask(t, settings) === q)
        .sort(
          (a, b) =>
            calcPriorityRank(b.importanceScore, b.urgencyScore) -
            calcPriorityRank(a.importanceScore, a.urgencyScore)
        ),
    [tasks, settings]
  );

  function handleDragStart({ active }: DragStartEvent) {
    const t = tasks.find((t) => t.id === active.id);
    setActiveTask(t ?? null);
    lastOverRef.current = t ? { id: t.id, quadrant: quadrantOfTask(t, settings) } : null;
  }

  function handleDragOver({ over }: DragOverEvent) {
    if (!over) return;
    const overId = String(over.id);
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

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveTask(null);
    const overId = over ? String(over.id) : lastOverRef.current?.id;
    lastOverRef.current = null;
    if (!overId || active.id === overId) return;

    const dragged = tasks.find((t) => t.id === active.id);
    if (!dragged) return;

    const currentQuadrant = quadrantOfTask(dragged, settings);
    let targetQuadrant: Quadrant;
    let above: TaskWithMeta | null = null;
    let below: TaskWithMeta | null = null;

    if (isQuadrantId(overId)) {
      targetQuadrant = overId;
      if (targetQuadrant === currentQuadrant) {
        const col = tasksByQuadrant(targetQuadrant).filter((t) => t.id !== dragged.id);
        above = col[col.length - 1] ?? null;
      }
    } else {
      const overTask = tasks.find((t) => t.id === overId);
      if (!overTask) return;

      targetQuadrant = quadrantOfTask(overTask, settings);
      const col = tasksByQuadrant(targetQuadrant).filter((t) => t.id !== dragged.id);
      const overIdx = col.findIndex((t) => t.id === overId);
      if (overIdx === -1) return;

      const activeRect = active.rect.current.translated ?? active.rect.current.initial;
      const insertAfter = over && activeRect
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

    const { importanceScore, urgencyScore } = scoresForInsert(
      targetQuadrant,
      above,
      below,
      dragged,
      settings
    );
    const quadrant = targetQuadrant;

    if (
      targetQuadrant === currentQuadrant &&
      importanceScore === dragged.importanceScore &&
      urgencyScore === dragged.urgencyScore
    ) {
      return;
    }

    ignoreSyncUntilRef.current = Date.now() + 15_000;

    setTasks((prev) =>
      prev.map((t) =>
        t.id === dragged.id ? { ...t, importanceScore, urgencyScore, quadrant } : t
      )
    );

    fetch(`/api/tasks/${dragged.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ importanceScore, urgencyScore }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((updated: TaskWithMeta | null) => {
        if (updated) {
          setTasks((prev) =>
            prev.map((t) =>
              t.id === updated.id
                ? { ...t, ...updated, importanceScore, urgencyScore, quadrant }
                : t
            )
          );
        }
      })
      .catch(() => {
        setTasks((prev) => prev.map((t) => (t.id === dragged.id ? dragged : t)));
      });
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

  const handleSynced = useCallback(async () => {
    if (Date.now() < ignoreSyncUntilRef.current) return;
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
      <div className="mb-4">
        <ScoreWidget tasks={tasks} />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {quadrantOrder.map((q) => (
          <QuadrantColumn
            key={q}
            quadrant={q}
            tasks={tasksByQuadrant(q)}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onStatusToggle={handleStatusToggle}
          />
        ))}
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
