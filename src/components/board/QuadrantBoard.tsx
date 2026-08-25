"use client";
import { useState, useCallback } from "react";
import { QuadrantColumn } from "./QuadrantColumn";
import { TaskModal } from "@/components/task/TaskModal";
import type { TaskWithMeta, Quadrant } from "@/types";

interface QuadrantBoardProps {
  initialTasks: TaskWithMeta[];
}

export function QuadrantBoard({ initialTasks }: QuadrantBoardProps) {
  const [tasks, setTasks] = useState<TaskWithMeta[]>(initialTasks);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskWithMeta | null>(null);

  const quadrantOrder: Quadrant[] = ["Q1", "Q2", "Q3", "Q4"];

  const tasksByQuadrant = (q: Quadrant) =>
    tasks
      .filter((t) => t.quadrant === q)
      .sort((a, b) => b.priorityRank - a.priorityRank);

  const handleAdd = useCallback((quadrant: Quadrant) => {
    setEditingTask(null);
    setModalOpen(true);
    // quadrant hint not strictly needed since server recalculates
    void quadrant;
  }, []);

  const handleEdit = useCallback((task: TaskWithMeta) => {
    setEditingTask(task);
    setModalOpen(true);
  }, []);

  const handleSave = async (data: {
    title: string;
    description: string;
    importanceScore: number;
    dueDate: string | null;
  }) => {
    if (editingTask) {
      // Update
      const res = await fetch(`/api/tasks/${editingTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const updated: TaskWithMeta = await res.json();
        setTasks((prev) =>
          prev.map((t) => (t.id === updated.id ? updated : t))
        );
      }
    } else {
      // Create
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const created: TaskWithMeta = await res.json();
        setTasks((prev) => [...prev, created]);
      }
    }
  };

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm("Task를 삭제할까요?")) return;
    const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    if (res.ok) {
      setTasks((prev) => prev.filter((t) => t.id !== id));
    }
  }, []);

  const handleStatusToggle = useCallback(
    async (id: string, status: "TODO" | "IN_PROGRESS" | "DONE") => {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const updated: TaskWithMeta = await res.json();
        setTasks((prev) =>
          prev.map((t) => (t.id === updated.id ? updated : t))
        );
      }
    },
    []
  );

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {quadrantOrder.map((q) => (
          <QuadrantColumn
            key={q}
            quadrant={q}
            tasks={tasksByQuadrant(q)}
            onAdd={handleAdd}
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
