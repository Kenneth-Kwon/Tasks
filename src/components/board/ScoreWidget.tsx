"use client";
import { useState, useEffect, useRef } from "react";
import { TrendingUp, TrendingDown, Minus, RefreshCw } from "lucide-react";
import type { ScoreResult } from "@/lib/score";

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
  refreshTrigger?: number;
}

export function ScoreWidget({ refreshTrigger = 0 }: ScoreWidgetProps) {
  const [data, setData] = useState<ScoreResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const fetchedOnce = useRef(false);

  async function fetchScore() {
    if (!fetchedOnce.current) setLoading(true);
    setError(false);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch("/api/score", { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        setData(await res.json());
        fetchedOnce.current = true;
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchScore(); }, [refreshTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
        <p className="text-sm text-slate-400">점수 계산 중...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between">
        <p className="text-sm text-slate-400">점수를 불러올 수 없습니다.</p>
        <button onClick={fetchScore} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  const TrendIcon = data.weeklyTrend === "up" ? TrendingUp
    : data.weeklyTrend === "down" ? TrendingDown : Minus;
  const trendColor = data.weeklyTrend === "up" ? "text-emerald-500"
    : data.weeklyTrend === "down" ? "text-red-500" : "text-slate-400";

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

      {/* 팁 */}
      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-xs text-slate-500 dark:text-slate-400">{data.tip}</p>
        <button
          onClick={fetchScore}
          className="shrink-0 p-1 rounded hover:bg-white/60 dark:hover:bg-slate-800/40 text-slate-400 transition-colors"
          title="점수 새로고침"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* 포인트 상세 */}
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
