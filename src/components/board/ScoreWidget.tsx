"use client";
import { useMemo } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { calcScore } from "@/lib/score";
import type { TaskWithMeta } from "@/types";

const GRADE_COLOR: Record<string, string> = {
  S: "text-violet-600 dark:text-violet-400",
  A: "text-blue-600 dark:text-blue-400",
  B: "text-emerald-600 dark:text-emerald-400",
  C: "text-amber-600 dark:text-amber-400",
  D: "text-red-600 dark:text-red-400",
};

const GRADE_BG: Record<string, string> = {
  S: "bg-violet-50 border-violet-200 dark:bg-violet-950/30 dark:border-violet-800",
  A: "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800",
  B: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800",
  C: "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800",
  D: "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800",
};

interface ScoreWidgetProps {
  tasks: TaskWithMeta[];
  compact?: boolean;
}

export function ScoreWidget({ tasks, compact }: ScoreWidgetProps) {
  const data = useMemo(() => calcScore(tasks), [tasks]);

  const TrendIcon = data.weeklyTrend === "up" ? TrendingUp
    : data.weeklyTrend === "down" ? TrendingDown : Minus;
  const trendColor = data.weeklyTrend === "up" ? "text-emerald-500"
    : data.weeklyTrend === "down" ? "text-red-500" : "text-slate-400";

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="text-slate-500 dark:text-slate-400">생산성</span>
        <span className={`font-bold tabular-nums ${GRADE_COLOR[data.grade]}`}>
          {data.score}
        </span>
        <span className="text-slate-400">/100</span>
        <span className={`font-semibold ${GRADE_COLOR[data.grade]}`}>{data.grade}</span>
        <TrendIcon className={`h-3.5 w-3.5 ${trendColor}`} />
        <span className="text-xs text-slate-400">+{data.earnedPoints}pt</span>
        {data.lostPoints > 0 && (
          <span className="text-xs text-slate-400">· -{data.lostPoints}pt</span>
        )}
      </div>
    );
  }

  return (
    <div className={`rounded-xl border p-4 ${GRADE_BG[data.grade]}`}>
      <div className="flex items-start justify-between gap-3">
        {/* 점수 & 등급 */}
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
            주간 생산성 점수
          </p>
          <div className="flex items-baseline gap-2">
            <span className={`text-4xl font-bold tabular-nums ${GRADE_COLOR[data.grade]}`}>
              {data.score}
            </span>
            <span className="text-lg text-slate-400">/100</span>
            <span className={`text-xl font-bold ml-1 ${GRADE_COLOR[data.grade]}`}>
              {data.grade}
            </span>
            <TrendIcon className={`h-4 w-4 ${trendColor}`} />
          </div>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 font-medium">
            {data.feedback}
          </p>
        </div>

        {/* 사분면별 완료 */}
        <div className="shrink-0 grid grid-cols-2 gap-1 text-center">
          {(["Q1", "Q2", "Q3", "Q4"] as const).map((q) => (
            <div key={q} className="bg-white/60 dark:bg-slate-900/40 rounded-md px-2 py-1">
              <div className="text-xs text-slate-500">{q}</div>
              <div className="text-sm font-semibold">{data.completedByQ[q]}
                <span className="text-xs font-normal text-slate-400">완</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{data.tip}</p>

      <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
        <span>+{data.earnedPoints}pt 획득</span>
        <span>·</span>
        <span>-{data.lostPoints}pt 손실</span>
        {Object.values(data.overdueByQ).some((v) => v > 0) && (
          <>
            <span>·</span>
            <span className="text-red-500">
              연체 Q1:{data.overdueByQ.Q1} Q2:{data.overdueByQ.Q2}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
