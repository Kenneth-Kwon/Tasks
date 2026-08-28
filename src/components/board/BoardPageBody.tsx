"use client";
import { RefreshCcw } from "lucide-react";
import { QuadrantBoard } from "@/components/board/QuadrantBoard";
import { useViewMode } from "@/hooks/useViewMode";
import type { TaskWithMeta } from "@/types";

export function BoardPageBody({ initialTasks }: { initialTasks: TaskWithMeta[] }) {
  const { isSimple } = useViewMode();

  return (
    <main
      className={
        isSimple
          ? "flex min-h-0 flex-1 flex-col px-3 py-2"
          : "mx-auto max-w-6xl px-4 py-6"
      }
    >
      {!isSimple && (
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-xl font-bold">시간 관리 매트릭스</h1>
            <p className="mt-1 text-sm text-slate-500">
              중요도와 기한을 입력하면 Task가 자동으로 사분면에 배치됩니다.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <RefreshCcw className="h-3.5 w-3.5" />
            페이지 새로고침 시 실시간 반영
          </div>
        </div>
      )}

      <div className={isSimple ? "flex min-h-0 flex-1 flex-col" : undefined}>
        <QuadrantBoard initialTasks={initialTasks} />
      </div>

      {!isSimple && (
        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
            사분면 배치 기준
          </h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { q: "Q2", color: "bg-blue-500", desc: "중요도 ≥7 + 긴급도 <7 → 핵심 투자 (좌상단)" },
              { q: "Q1", color: "bg-red-500", desc: "중요도 ≥7 + 긴급도 ≥7 → 즉시 처리 (우상단)" },
              { q: "Q4", color: "bg-gray-400", desc: "중요도 <7 + 긴급도 <7 → 제거 (좌하단)" },
              { q: "Q3", color: "bg-amber-500", desc: "중요도 <7 + 긴급도 ≥7 → 위임/거절 (우하단)" },
            ].map((item) => (
              <div key={item.q} className="flex items-start gap-2">
                <div className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${item.color}`} />
                <p className="text-xs text-slate-500">{item.desc}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-400">
            긴급도는 기한(Due Date)까지 남은 일수로 자동 계산됩니다.
            중요도(1–10)는 Task 추가 시 직접 입력합니다.
          </p>
        </div>
      )}
    </main>
  );
}
