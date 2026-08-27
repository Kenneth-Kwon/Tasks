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
 */
export function scoresForInsert(
  quadrant: Quadrant,
  above: TaskWithMeta | null,
  below: TaskWithMeta | null,
  dragged: TaskWithMeta,
  settings: QuadrantSettings
): { importanceScore: number; urgencyScore: number } {
  if (!above && !below) {
    return clampToQuadrant(
      quadrant,
      dragged.importanceScore,
      dragged.urgencyScore,
      settings
    );
  }

  const bounds = quadrantBounds(quadrant, settings);
  const importanceScore = Math.round(
    ((above?.importanceScore ?? bounds.importance.max) +
      (below?.importanceScore ?? bounds.importance.min)) /
      2
  );
  const urgencyScore = Math.round(
    ((above?.urgencyScore ?? bounds.urgency.max) +
      (below?.urgencyScore ?? bounds.urgency.min)) /
      2
  );

  return clampToQuadrant(quadrant, importanceScore, urgencyScore, settings);
}

export function quadrantOfTask(task: TaskWithMeta, settings: QuadrantSettings): Quadrant {
  return calcQuadrantWithSettings(task.importanceScore, task.urgencyScore, settings);
}
