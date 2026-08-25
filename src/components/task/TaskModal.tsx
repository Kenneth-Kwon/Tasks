"use client";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { calcUrgencyScore, calcQuadrant, QUADRANT_META } from "@/lib/quadrant";
import type { TaskWithMeta } from "@/types";

interface TaskModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: {
    title: string;
    description: string;
    importanceScore: number;
    dueDate: string | null;
  }) => Promise<void>;
  task?: TaskWithMeta | null;
}

export function TaskModal({ open, onClose, onSave, task }: TaskModalProps) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [importanceScore, setImportanceScore] = useState(
    task?.importanceScore ?? 5
  );
  const [dueDate, setDueDate] = useState(
    task?.dueDate ? task.dueDate.slice(0, 10) : ""
  );
  const [saving, setSaving] = useState(false);

  const dueDateObj = dueDate ? new Date(dueDate + "T00:00:00") : null;
  const urgency = calcUrgencyScore(dueDateObj);
  const previewQuadrant = calcQuadrant(importanceScore, urgency);
  const meta = QUADRANT_META[previewQuadrant];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim(),
        importanceScore,
        dueDate: dueDate ? new Date(dueDate + "T00:00:00").toISOString() : null,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{task ? "Task 수정" : "새 Task 추가"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* 제목 */}
          <div className="space-y-1.5">
            <Label htmlFor="title">제목 *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task 제목을 입력하세요"
              required
              autoFocus
            />
          </div>

          {/* 설명 */}
          <div className="space-y-1.5">
            <Label htmlFor="desc">설명</Label>
            <Textarea
              id="desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="선택 사항"
              rows={3}
            />
          </div>

          {/* 중요도 슬라이더 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>중요도</Label>
              <span className="text-sm font-semibold tabular-nums">
                {importanceScore} / 10
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              value={importanceScore}
              onChange={(e) => setImportanceScore(Number(e.target.value))}
              className="w-full accent-blue-600"
            />
            <div className="flex justify-between text-xs text-slate-400">
              <span>낮음</span>
              <span>높음</span>
            </div>
          </div>

          {/* 기한 */}
          <div className="space-y-1.5">
            <Label htmlFor="due">기한 (Due Date)</Label>
            <Input
              id="due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          {/* 사분면 미리보기 */}
          <div
            className={`rounded-lg border p-3 ${meta.bgColor} ${meta.borderColor}`}
          >
            <div className="flex items-center gap-2">
              <div className={`h-2.5 w-2.5 rounded-full ${meta.dotColor}`} />
              <span className="text-sm font-medium">{meta.label}</span>
              <span className="text-xs text-slate-500">— {meta.sub}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              긴급도 {urgency}/10 · {meta.desc}
            </p>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              취소
            </Button>
            <Button type="submit" disabled={saving || !title.trim()}>
              {saving ? "저장 중..." : task ? "수정" : "추가"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
