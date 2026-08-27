"use client";
import { useState } from "react";
import { Settings2, X } from "lucide-react";
import { type QuadrantSettings, DEFAULT_SETTINGS } from "@/lib/settings";

interface SettingsModalProps {
  settings: QuadrantSettings;
  onSave: (s: QuadrantSettings) => void;
}

function Row({ label, sub, value, min, max, onChange }: {
  label: string;
  sub: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{sub}</p>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-28 accent-blue-600"
        />
        <span className="w-6 text-right text-sm font-semibold tabular-nums">{value}</span>
      </div>
    </div>
  );
}

export function SettingsModal({ settings, onSave }: SettingsModalProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<QuadrantSettings>(settings);

  function handleOpen() {
    setDraft(settings);
    setOpen(true);
  }

  function handleSave() {
    onSave(draft);
    setOpen(false);
  }

  function handleReset() {
    setDraft(DEFAULT_SETTINGS);
  }

  const set = <K extends keyof QuadrantSettings>(key: K, value: QuadrantSettings[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        title="사분면 설정"
        className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
      >
        <Settings2 className="h-3.5 w-3.5" />
        설정
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-950">
            {/* 헤더 */}
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
              <div>
                <h2 className="text-base font-semibold">사분면 설정</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">사분면 분류 기준을 조정합니다</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-6 px-5 py-5">
              {/* 중요도 기준 */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">중요도 기준</h3>
                <Row
                  label="'중요' 판정 임계값"
                  sub={`중요도 ≥ ${draft.importantMin} 이면 '중요'로 분류`}
                  value={draft.importantMin}
                  min={1}
                  max={10}
                  onChange={(v) => set("importantMin", v)}
                />
              </div>

              {/* 긴급도 기준 */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">긴급도 기준</h3>
                <Row
                  label="'긴급' 판정 임계값"
                  sub={`긴급도 ≥ ${draft.urgentMin} 이면 '긴급'으로 분류`}
                  value={draft.urgentMin}
                  min={1}
                  max={10}
                  onChange={(v) => set("urgentMin", v)}
                />
              </div>

              {/* 날짜별 긴급도 계산 */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">날짜별 긴급도 자동 계산</h3>
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900 space-y-3">
                  <Row
                    label="긴급 기준일"
                    sub={`${draft.urgentDays}일 이내 → 긴급도 8 (Q1 진입 가능)`}
                    value={draft.urgentDays}
                    min={1}
                    max={30}
                    onChange={(v) => set("urgentDays", Math.min(v, draft.warningDays - 1))}
                  />
                  <div className="border-t border-slate-200 dark:border-slate-700" />
                  <Row
                    label="주의 기준일"
                    sub={`${draft.warningDays}일 이내 → 긴급도 6`}
                    value={draft.warningDays}
                    min={draft.urgentDays + 1}
                    max={60}
                    onChange={(v) => set("warningDays", v)}
                  />
                  <div className="border-t border-slate-200 dark:border-slate-700" />
                  <Row
                    label="날짜 미설정 시 긴급도"
                    sub="due date가 없을 때 기본 긴급도"
                    value={draft.noDateUrgency}
                    min={1}
                    max={10}
                    onChange={(v) => set("noDateUrgency", v)}
                  />
                </div>

                {/* 현재 설정 요약 */}
                <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 px-3 py-2 text-xs text-blue-700 dark:text-blue-300 space-y-0.5">
                  <p>• 기한 초과 → 긴급도 10</p>
                  <p>• {draft.urgentDays}일 이내 → 긴급도 8</p>
                  <p>• {draft.warningDays}일 이내 → 긴급도 6</p>
                  <p>• 14일 이내 → 긴급도 4 · 30일 이내 → 2 · 초과 → 1</p>
                  <p>• 날짜 없음 → 긴급도 {draft.noDateUrgency}</p>
                </div>
              </div>
            </div>

            {/* 푸터 */}
            <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-700 px-5 py-4">
              <button
                type="button"
                onClick={handleReset}
                className="text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                기본값으로 초기화
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="rounded-lg bg-slate-900 dark:bg-slate-50 px-4 py-2 text-sm font-medium text-white dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-slate-200 transition-colors"
                >
                  저장
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
