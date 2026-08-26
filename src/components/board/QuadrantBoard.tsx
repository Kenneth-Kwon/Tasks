"use client";
import { useState, useCallback, useEffect, useRef } from "react";
import { Plus } from "lucide-react";

const AUTO_SYNC_INTERVAL = 15 * 60 * 1000; // 15분
import { QuadrantColumn } from "./QuadrantColumn";
import { TaskModal } from "@/components/task/TaskModal";
import { ScoreWidget } from "./ScoreWidget";
import { SyncButton } from "./SyncButton";
import type { TaskWithMeta, Quadrant } from "@/types";

interface QuadrantBoardProps {
  initialTasks: TaskWithMeta[];
}

export function QuadrantBoard({ initialTasks }: QuadrantBoardProps) {
  const [tasks, setTasks] = useState<TaskWithMeta[]>(initialTasks);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskWithMeta | null>(null);
  const [scoreKey, setScoreKey] = useState(0);

  // 배치: Q2(중요+여유) Q1(긴급+중요) / Q4(비중요+비긴급) Q3(긴급+비중요)
  const quadrantOrder: Quadrant[] = ["Q2", "Q1", "Q4", "Q3"];

  const tasksByQuadrant = (q: Quadrant) =>
    tasks.filter((t) => t.quadrant === q).sort((a, b) => b.priorityRank - a.priorityRank);

  const handleAdd = useCallback(() => { setEditingTask(null); setModalOpen(true); }, []);
  const handleEdit = useCallback((task: TaskWithMeta) => { setEditingTask(task); setModalOpen(true); }, []);

  const handleSave = async (data: {
    title: string; description: string; importanceScore: number; dueDate: string | null;
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
        const created: TaskWithMeta = await res.json();
        setTasks((prev) => [...prev, created]);
      }
    }
    setScoreKey((k) => k + 1);
  };

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm("Task를 삭제할까요?")) return;
    const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    if (res.ok) { setTasks((prev) => prev.filter((t) => t.id !== id)); setScoreKey((k) => k + 1); }
  }, []);

  const handleStatusToggle = useCallback(async (id: string, status: "TODO" | "IN_PROGRESS" | "DONE") => {
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const updated: TaskWithMeta = await res.json();
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setScoreKey((k) => k + 1);
    }
  }, []);

  const handleSynced = useCallback(async () => {
    const res = await fetch("/api/tasks");
    if (res.ok) { setTasks(await res.json()); setScoreKey((k) => k + 1); }
  }, []);

  const lastSyncRef = useRef<Date | null>(null);

  // 15분마다 자동 동기화 (브라우저 탭이 열려 있는 동안)
  useEffect(() => {
    const runSync = async () => {
      try {
        const res = await fetch("/api/tasks/sync-google", { method: "POST" });
        if (res.ok) {
          lastSyncRef.current = new Date();
          await handleSynced();
        }
      } catch { /* 자동 동기화 실패 무시 */ }
    };

    // 페이지 첫 로드 시 즉시 1회 실행
    runSync();

    const timer = setInterval(runSync, AUTO_SYNC_INTERVAL);
    return () => clearInterval(timer);
  }, [handleSynced]);

  return (
    <>
      {/* 생산성 점수 */}
      <div key={scoreKey} className="mb-4">
        <ScoreWidget />
      </div>

      {/* 상단 액션 바 */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <SyncButton onSynced={handleSynced} />
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 active:scale-[0.98] transition-all dark:bg-slate-50 dark:text-slate-900 dark:hover:bg-slate-200"
        >
          <Plus className="h-4 w-4" />
          새 Task 추가
        </button>
      </div>

      {/* 4사분면 보드 */}
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

      <TaskModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingTask(null); }}
        onSave={handleSave}
        task={editingTask}
      />
    </>
  );
}
