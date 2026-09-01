import { calcPriorityRank } from "@/lib/quadrant";
import { calcQuadrantWithSettings, type QuadrantSettings } from "@/lib/settings";
import type { Quadrant, TaskWithMeta } from "@/types";

type ScoreRange = { min: number; max: number };

export function quadrantBounds(quadrant: Quadrant, settings: QuadrantSettings): {
  importance: ScoreRange;
  urgency: ScoreRange;
} {
  const important = quadrant === "Q1" || quadrant === "Q2";
  const urgent = quadrant === "Q1" || quadrant === "Q3";

  return {
    importance: important
      ? { min: settings.importantMin, max: 10 }
      : { min: 1, max: Math.max(1, settings.importantMin - 1) },
    urgency: urgent
      ? { min: settings.urgentMin, max: 10 }
      : { min: 1, max: Math.max(1, settings.urgentMin - 1) },
  };
}

function clampScore(value: number, range: ScoreRange): number {
  return Math.round(Math.max(range.min, Math.min(range.max, value)));
}

export function clampToQuadrant(
  quadrant: Quadrant,
  importanceScore: number,
  urgencyScore: number,
  settings: QuadrantSettings
): { importanceScore: number; urgencyScore: number } {
  const bounds = quadrantBounds(quadrant, settings);
  return {
    importanceScore: clampScore(importanceScore, bounds.importance),
    urgencyScore: clampScore(urgencyScore, bounds.urgency),
  };
}

function rankOf(task: Pick<TaskWithMeta, "importanceScore" | "urgencyScore">) {
  return calcPriorityRank(task.importanceScore, task.urgencyScore);
}

/** 사분면 범위 안에서 targetRank에 가장 가까운 정수 점수 쌍을 고른다. */
function scoresForRank(
  quadrant: Quadrant,
  targetRank: number,
  dragged: TaskWithMeta,
  settings: QuadrantSettings
): { importanceScore: number; urgencyScore: number } {
  const bounds = quadrantBounds(quadrant, settings);
  let best = {
    importanceScore: clampScore(dragged.importanceScore, bounds.importance),
    urgencyScore: clampScore(dragged.urgencyScore, bounds.urgency),
    dist: Number.POSITIVE_INFINITY,
    closeness: Number.POSITIVE_INFINITY,
  };

  for (let importanceScore = bounds.importance.min; importanceScore <= bounds.importance.max; importanceScore++) {
    for (let urgencyScore = bounds.urgency.min; urgencyScore <= bounds.urgency.max; urgencyScore++) {
      const dist = Math.abs(calcPriorityRank(importanceScore, urgencyScore) - targetRank);
      const closeness =
        Math.abs(importanceScore - dragged.importanceScore) +
        Math.abs(urgencyScore - dragged.urgencyScore);
      if (dist < best.dist || (dist === best.dist && closeness < best.closeness)) {
        best = { importanceScore, urgencyScore, dist, closeness };
      }
    }
  }

  return { importanceScore: best.importanceScore, urgencyScore: best.urgencyScore };
}

/**
 * 위/아래 이웃 사이에 오도록 중요도·시급성 지수를 다시 계산한다.
 * 정렬은 중요도×0.6 + 시급성×0.4 내림차순이므로, 그 중간 순위에 맞는 점수를 고른다.
 */
export function scoresForInsert(
  quadrant: Quadrant,
  above: TaskWithMeta | null,
  below: TaskWithMeta | null,
  dragged: TaskWithMeta,
  settings: QuadrantSettings
): { importanceScore: number; urgencyScore: number } {
  if (!above && !below) {
    return clampToQuadrant(quadrant, dragged.importanceScore, dragged.urgencyScore, settings);
  }

  const aboveRank = above ? rankOf(above) : rankOf(below!) + 1;
  const belowRank = below ? rankOf(below) : rankOf(above!) - 1;
  const targetRank = (aboveRank + belowRank) / 2;

  return scoresForRank(quadrant, targetRank, dragged, settings);
}

export function quadrantOfTask(task: TaskWithMeta, settings: QuadrantSettings): Quadrant {
  return calcQuadrantWithSettings(task.importanceScore, task.urgencyScore, settings);
}

/**
 * 위아래 이웃 사이에 끼워넣을 sortOrder 계산 (float 중간값)
 *
 * 정렬 기준: sortOrder DESC (값이 클수록 위에 표시)
 *   - above: 삽입 위치 바로 위의 task (sortOrder 더 큰 쪽)
 *   - below: 삽입 위치 바로 아래의 task (sortOrder 더 작은 쪽)
 */
export function sortOrderBetween(
  above: TaskWithMeta | null,
  below: TaskWithMeta | null,
  dragged: TaskWithMeta
): number {
  // 이웃이 없으면 변경 불필요 (유일한 task거나 같은 위치)
  if (!above && !below) return dragged.sortOrder;
  // 맨 위에 삽입: 현재 최상단보다 10000 높게
  if (!above) return below!.sortOrder + 10000;
  // 맨 아래에 삽입: 현재 최하단보다 10000 낮게
  if (!below) return above!.sortOrder - 10000;
  // 중간 삽입: 두 이웃의 중간값
  return (above.sortOrder + below.sortOrder) / 2;
}
