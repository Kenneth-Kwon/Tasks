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

/**
 * 사분면 안 위/아래 이웃의 중간값으로 중요도·긴급도를 만들고,
 * 대상 사분면 범위에 맞게 보정한다.
 *
 * preserveUrgency=true (같은 사분면 내 재정렬): urgencyScore는 그대로 유지하고
 * importanceScore만 보간한다. 이렇게 해야 dueDate로 결정된 urgency가 의미 없이
 * 바뀌지 않고, urgency가 같은 task끼리 재정렬할 때 snap-back이 발생하지 않는다.
 */
export function scoresForInsert(
  quadrant: Quadrant,
  above: TaskWithMeta | null,
  below: TaskWithMeta | null,
  dragged: TaskWithMeta,
  settings: QuadrantSettings,
  preserveUrgency = false
): { importanceScore: number; urgencyScore: number } {
  const bounds = quadrantBounds(quadrant, settings);

  // 중요도: 위아래 이웃의 중간값 (이웃 없으면 range edge 사용)
  const rawImportance =
    !above && !below
      ? dragged.importanceScore
      : Math.round(
          ((above?.importanceScore ?? bounds.importance.max) +
            (below?.importanceScore ?? bounds.importance.min)) /
            2
        );
  const importanceScore = clampScore(rawImportance, bounds.importance);

  // 긴급도: 같은 사분면 내 재정렬이면 기존값 유지, 사분면 이동이면 target bounds에 clamp
  const urgencyScore = preserveUrgency
    ? dragged.urgencyScore
    : clampScore(dragged.urgencyScore, bounds.urgency);

  return { importanceScore, urgencyScore };
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
