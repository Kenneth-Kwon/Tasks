import type { Quadrant, TaskStatus } from "@prisma/client";

export type ScoreableTask = {
  status: TaskStatus;
  quadrant: Quadrant;
  updatedAt: Date | string;
  dueDate: Date | string | null;
};

/** 사분면별 완료 가중치 */
const COMPLETE_WEIGHT: Record<Quadrant, number> = {
  Q1: 10,  // 긴급+중요 — 최고 점수
  Q2: 7,   // 중요+여유 — 높은 점수 (전략적 행동)
  Q3: 2,   // 긴급+비중요 — 낮은 점수
  Q4: 1,   // 비긴급+비중요 — 최저 점수
};

/** 사분면별 미완료(연체) 패널티 */
const OVERDUE_PENALTY: Record<Quadrant, number> = {
  Q1: 8,   // Q1 방치는 매우 위험
  Q2: 4,   // Q2 방치는 장기 손해
  Q3: 1,
  Q4: 0,
};

export interface ScoreResult {
  score: number;          // 0–100
  grade: "S" | "A" | "B" | "C" | "D";
  earnedPoints: number;
  lostPoints: number;
  completedByQ: Record<Quadrant, number>;
  overdueByQ: Record<Quadrant, number>;
  feedback: string;
  tip: string;
  weeklyTrend: "up" | "down" | "stable";
}

export function calcScore(tasks: ScoreableTask[]): ScoreResult {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const completedByQ: Record<Quadrant, number> = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 };
  const overdueByQ: Record<Quadrant, number> = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 };

  for (const task of tasks) {
    if (task.status === "DONE") {
      // 지난 7일 이내 완료된 것만 점수에 반영
      const updatedAt = new Date(task.updatedAt);
      if (updatedAt >= weekAgo) {
        completedByQ[task.quadrant]++;
      }
    } else {
      // 기한이 지난 미완료 Task
      if (task.dueDate && new Date(task.dueDate) < now) {
        overdueByQ[task.quadrant]++;
      }
    }
  }

  // 점수 계산
  let earnedPoints = 0;
  let lostPoints = 0;

  for (const q of ["Q1", "Q2", "Q3", "Q4"] as Quadrant[]) {
    earnedPoints += completedByQ[q] * COMPLETE_WEIGHT[q];
    lostPoints += overdueByQ[q] * OVERDUE_PENALTY[q];
  }

  // 0~100 범위로 정규화
  const total = earnedPoints + lostPoints;
  const rawScore = total === 0
    ? 50  // 활동 없으면 중립 50점
    : Math.round((earnedPoints / (total + 10)) * 100);

  // Q1+Q2 완료 비율 보너스
  const importantDone = completedByQ.Q1 + completedByQ.Q2;
  const trivialDone = completedByQ.Q3 + completedByQ.Q4;
  const focusBonus = importantDone > 0 && trivialDone === 0 ? 10
    : importantDone > trivialDone ? 5
    : 0;

  const score = Math.min(100, Math.max(0, rawScore + focusBonus));

  // 등급
  const grade: ScoreResult["grade"] =
    score >= 90 ? "S" :
    score >= 75 ? "A" :
    score >= 55 ? "B" :
    score >= 35 ? "C" : "D";

  // 피드백 메시지
  const feedback =
    grade === "S" ? "탁월합니다! 중요한 일에 완벽하게 집중하고 있습니다." :
    grade === "A" ? "훌륭합니다. 효과적으로 우선순위를 관리하고 있습니다." :
    grade === "B" ? "보통입니다. Q1·Q2 Task에 더 집중해보세요." :
    grade === "C" ? "주의가 필요합니다. 중요한 Task들이 쌓이고 있습니다." :
    "위기 상황! Q1 긴급 Task를 즉시 처리해야 합니다.";

  // 실행 팁
  const tip =
    overdueByQ.Q1 > 0 ? `⚡ Q1 연체 ${overdueByQ.Q1}개 — 지금 바로 처리하세요.` :
    overdueByQ.Q2 > 0 ? `📌 Q2 연체 ${overdueByQ.Q2}개 — 이번 주 안에 해결하세요.` :
    completedByQ.Q4 > completedByQ.Q1 + completedByQ.Q2 ?
      "⚠️ 사소한 일보다 중요한 일 위주로 업무를 재편하세요." :
    importantDone === 0 ? "Q2 핵심 Task를 하나 골라 오늘 집중해보세요." :
    "잘 하고 있습니다. Q2 투자 시간을 유지하세요.";

  // 트렌드 (단순화: Q1 연체 있으면 down, 없고 완료 있으면 up)
  const weeklyTrend: ScoreResult["weeklyTrend"] =
    overdueByQ.Q1 > 0 ? "down" :
    importantDone > 0 ? "up" : "stable";

  return {
    score,
    grade,
    earnedPoints,
    lostPoints,
    completedByQ,
    overdueByQ,
    feedback,
    tip,
    weeklyTrend,
  };
}
