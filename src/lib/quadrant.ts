import { Quadrant } from "@prisma/client";

/**
 * dueDate 기반으로 긴급도(1–10)를 자동 계산
 */
export function calcUrgencyScore(dueDate: Date | null | undefined): number {
  if (!dueDate) return 5;

  const now = new Date();
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysLeft = Math.floor((dueDate.getTime() - now.getTime()) / msPerDay);

  if (daysLeft <= 0) return 10;
  if (daysLeft <= 1) return 9;
  if (daysLeft <= 3) return 8;
  if (daysLeft <= 7) return 6;
  if (daysLeft <= 14) return 4;
  if (daysLeft <= 30) return 2;
  return 1;
}

/**
 * 중요도 + 긴급도로 사분면 결정 (임계값 7)
 */
export function calcQuadrant(
  importanceScore: number,
  urgencyScore: number
): Quadrant {
  const isImportant = importanceScore >= 7;
  const isUrgent = urgencyScore >= 7;

  if (isImportant && isUrgent) return Quadrant.Q1;
  if (isImportant && !isUrgent) return Quadrant.Q2;
  if (!isImportant && isUrgent) return Quadrant.Q3;
  return Quadrant.Q4;
}

/**
 * 사분면 내 우선순위 점수 계산 (높을수록 상위 노출)
 */
export function calcPriorityRank(
  importanceScore: number,
  urgencyScore: number
): number {
  return importanceScore * 0.6 + urgencyScore * 0.4;
}

export const QUADRANT_META = {
  Q1: {
    label: "제1사분면",
    sub: "긴급 + 중요",
    desc: "즉시 처리",
    color: "#ef4444",
    bgColor: "bg-red-50 dark:bg-red-950/20",
    borderColor: "border-red-200 dark:border-red-800",
    badgeColor: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    dotColor: "bg-red-500",
  },
  Q2: {
    label: "제2사분면",
    sub: "중요 + 여유",
    desc: "핵심 투자",
    color: "#3b82f6",
    bgColor: "bg-blue-50 dark:bg-blue-950/20",
    borderColor: "border-blue-200 dark:border-blue-800",
    badgeColor:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    dotColor: "bg-blue-500",
  },
  Q3: {
    label: "제3사분면",
    sub: "긴급 + 비중요",
    desc: "위임/거절",
    color: "#f59e0b",
    bgColor: "bg-amber-50 dark:bg-amber-950/20",
    borderColor: "border-amber-200 dark:border-amber-800",
    badgeColor:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    dotColor: "bg-amber-500",
  },
  Q4: {
    label: "제4사분면",
    sub: "비긴급 + 비중요",
    desc: "제거",
    color: "#6b7280",
    bgColor: "bg-gray-50 dark:bg-gray-950/20",
    borderColor: "border-gray-200 dark:border-gray-800",
    badgeColor:
      "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
    dotColor: "bg-gray-400",
  },
} as const;
