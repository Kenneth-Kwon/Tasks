"use client";
import { useState, useEffect } from "react";
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
import { QUADRANT_META } from "@/lib/quadrant";
import { calcQuadrantWithSettings, calcUrgencyWithSettings } from "@/lib/settings";
import { useSettings } from "@/hooks/useSettings";
import type { TaskWithMeta } from "@/types";

interface GoogleList {
  id: string;
  title: string;
}

interface TaskModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: {
    title: string;
    description: string;
    importanceScore: number;
    urgencyScore: number;
    dueDate: string | null;
    googleListId?: string | null;
  }) => Promise<void>;
  task?: TaskWithMeta | null;
}

export function TaskModal({ open, onClose, onSave, task }: TaskModalProps) {
  const { settings } = useSettings();
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [importanceScore, setImportanceScore] = useState(
    task?.importanceScore ?? 5
  );
  const [urgencyScore, setUrgencyScore] = useState(
    task?.urgencyScore ?? settings.noDateUrgency
  );
  const [dueDate, setDueDate] = useState(
    task?.dueDate ? task.dueDate.slice(0, 10) : ""
  );
  const [saving, setSaving] = useState(false);

  // Google 목록 관련
  const [googleLists, setGoogleLists] = useState<GoogleList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string>("");
  const [listsLoading, setListsLoading] = useState(false);

  const isNew = !task;

  useEffect(() => {
    if (!open) return;
    setTitle(task?.title ?? "");
    setDescription(task?.description ?? "");
    setImportanceScore(task?.importanceScore ?? 5);
    setUrgencyScore(task?.urgencyScore ?? settings.noDateUrgency);
    setDueDate(task?.dueDate ? task.dueDate.slice(0, 10) : "");
    setSaving(false);
  }, [open, task, settings.noDateUrgency]);

  // 새 Task 추가 모달이 열릴 때 Google 목록 로드
  useEffect(() => {
    if (open && isNew) {
      setListsLoading(true);
      fetch("/api/google-lists")
        .then((r) => r.json())
        .then((lists: GoogleList[]) => {
          setGoogleLists(lists);
          // "기타" 목록을 기본값으로 설정
          const kita = lists.find((l) =>
            ["기타", "Other", "other", "기타 (Other)"].includes(l.title)
          );
          setSelectedListId(kita?.id ?? lists[0]?.id ?? "");
        })
        .catch(() => setGoogleLists([]))
        .finally(() => setListsLoading(false));
    }
  }, [open, isNew]);

  const dueDateObj = dueDate ? new Date(dueDate + "T00:00:00") : null;
  const autoUrgency = dueDateObj
    ? calcUrgencyWithSettings(dueDateObj, settings)
    : null;
  const urgency = autoUrgency ?? urgencyScore;
  const previewQuadrant = calcQuadrantWithSettings(importanceScore, urgency, settings);
  const meta = QUADRANT_META[previewQuadrant];

  function handleDueDateChange(value: string) {
    setDueDate(value);
    if (value) {
      setUrgencyScore(calcUrgencyWithSettings(new Date(value + "T00:00:00"), settings));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim(),
        importanceScore,
        urgencyScore: urgency,
        dueDate: dueDate ? new Date(dueDate + "T00:00:00").toISOString() : null,
        googleListId: isNew ? (selectedListId || null) : undefined,
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
              onChange={(e) => handleDueDateChange(e.target.value)}
            />
            <p className="text-xs text-slate-400">
              기한을 넣으면 긴급도가 규칙에 따라 자동 계산됩니다. 기한이 없어도 중요도는 1–10으로 바꿀 수 있습니다.
            </p>
          </div>

          {/* 긴급도: 기한 있으면 자동, 없으면 직접 조절 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>긴급도</Label>
              <span className="text-sm font-semibold tabular-nums">
                {urgency} / 10
              </span>
            </div>
            {dueDate ? (
              <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                기한 기준으로 자동 계산되었습니다. 중요도를 바꿔도 날짜는 그대로입니다.
              </p>
            ) : (
              <>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={urgencyScore}
                  onChange={(e) => setUrgencyScore(Number(e.target.value))}
                  className="w-full accent-amber-500"
                />
                <div className="flex justify-between text-xs text-slate-400">
                  <span>여유</span>
                  <span>긴급</span>
                </div>
              </>
            )}
          </div>

          {/* Google Task 목록 선택 (새 Task만) */}
          {isNew && (
            <div className="space-y-1.5">
              <Label htmlFor="glist">Google Task 목록</Label>
              {listsLoading ? (
                <p className="text-xs text-slate-400">목록 불러오는 중...</p>
              ) : googleLists.length === 0 ? (
                <p className="text-xs text-slate-400">
                  Google Task 목록을 불러올 수 없습니다.
                </p>
              ) : (
                <select
                  id="glist"
                  value={selectedListId}
                  onChange={(e) => setSelectedListId(e.target.value)}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  {googleLists.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.title}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

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
