import { quadrantBounds } from "@/lib/drag-scores";
import type { QuadrantSettings } from "@/lib/settings";
import type { Quadrant, TaskWithMeta } from "@/types";

export type SubCell = "TL" | "TR" | "BL" | "BR";

export const SUB_CELLS: SubCell[] = ["TL", "TR", "BL", "BR"];

type ScoreRange = { min: number; max: number };

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function denormalize(t: number, min: number, max: number) {
  return Math.round(min + clamp01(t) * (max - min));
}

function splitRange(range: ScoreRange): { low: ScoreRange; high: ScoreRange } {
  if (range.min >= range.max) {
    return { low: range, high: range };
  }
  const mid = Math.floor((range.min + range.max) / 2);
  return {
    low: { min: range.min, max: mid },
    high: { min: Math.min(range.max, mid + 1), max: range.max },
  };
}

export function subCellRanges(quadrant: Quadrant, settings: QuadrantSettings) {
  const bounds = quadrantBounds(quadrant, settings);
  const importance = splitRange(bounds.importance);
  const urgency = splitRange(bounds.urgency);
  return { importance, urgency };
}

export function taskToSubCell(
  task: Pick<TaskWithMeta, "importanceScore" | "urgencyScore">,
  quadrant: Quadrant,
  settings: QuadrantSettings
): SubCell {
  const { importance, urgency } = subCellRanges(quadrant, settings);
  const highImp = task.importanceScore >= importance.high.min;
  const highUrg = task.urgencyScore >= urgency.high.min;
  if (highImp && highUrg) return "TR";
  if (highImp && !highUrg) return "TL";
  if (!highImp && highUrg) return "BR";
  return "BL";
}

export function scoresForSubCell(
  quadrant: Quadrant,
  cell: SubCell,
  dragged: Pick<TaskWithMeta, "importanceScore" | "urgencyScore">,
  settings: QuadrantSettings
): { importanceScore: number; urgencyScore: number } {
  const { importance, urgency } = subCellRanges(quadrant, settings);
  const impRange = cell === "TL" || cell === "TR" ? importance.high : importance.low;
  const urgRange = cell === "TR" || cell === "BR" ? urgency.high : urgency.low;

  const importanceScore =
    dragged.importanceScore >= impRange.min && dragged.importanceScore <= impRange.max
      ? dragged.importanceScore
      : Math.round((impRange.min + impRange.max) / 2);
  const urgencyScore =
    dragged.urgencyScore >= urgRange.min && dragged.urgencyScore <= urgRange.max
      ? dragged.urgencyScore
      : Math.round((urgRange.min + urgRange.max) / 2);

  return { importanceScore, urgencyScore };
}

export function parseSubCellId(id: string): { quadrant: Quadrant; cell: SubCell } | null {
  const match = /^(Q[1-4]):(TL|TR|BL|BR)$/.exec(id);
  if (!match) return null;
  return { quadrant: match[1] as Quadrant, cell: match[2] as SubCell };
}

export function isSubCellId(id: string): boolean {
  return parseSubCellId(id) !== null;
}

/** 플롯 좌표 (0–1) → 사분면 범위 안의 정수 점수. 시각적 2×2와 맞추기 위해 inset 없음 */
export function plotToScores(
  x: number,
  y: number,
  quadrant: Quadrant,
  settings: QuadrantSettings
): { importanceScore: number; urgencyScore: number } {
  const bounds = quadrantBounds(quadrant, settings);
  return {
    urgencyScore: denormalize(x, bounds.urgency.min, bounds.urgency.max),
    importanceScore: denormalize(y, bounds.importance.min, bounds.importance.max),
  };
}
