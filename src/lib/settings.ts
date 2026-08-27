export interface QuadrantSettings {
  /** 중요도 임계값: importanceScore >= 이 값이면 "중요" (기본 7) */
  importantMin: number;
  /** 긴급도 임계값: urgencyScore >= 이 값이면 "긴급" (기본 7) */
  urgentMin: number;
  /** 이 일수 이내면 긴급도 8 — 긴급 판정 (기본 3일) */
  urgentDays: number;
  /** 이 일수 이내면 긴급도 6 — 주의 판정 (기본 7일) */
  warningDays: number;
  /** due date 없을 때 기본 긴급도 (기본 5) */
  noDateUrgency: number;
}

export const DEFAULT_SETTINGS: QuadrantSettings = {
  importantMin: 7,
  urgentMin: 7,
  urgentDays: 3,
  warningDays: 7,
  noDateUrgency: 5,
};

export const SETTINGS_KEY = "focusmatrix_settings";

/** 설정 기반 긴급도 계산 */
export function calcUrgencyWithSettings(
  dueDate: Date | string | null | undefined,
  settings: QuadrantSettings
): number {
  if (!dueDate) return settings.noDateUrgency;

  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return settings.noDateUrgency;

  const daysLeft = Math.floor((due.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  if (daysLeft < 0) return 10;                          // 기한 초과
  if (daysLeft <= settings.urgentDays) return 8;        // 긴급
  if (daysLeft <= settings.warningDays) return 6;       // 주의
  if (daysLeft <= 14) return 4;
  if (daysLeft <= 30) return 2;
  return 1;
}

/** 설정 기반 사분면 결정 */
export function calcQuadrantWithSettings(
  importanceScore: number,
  urgencyScore: number,
  settings: QuadrantSettings
): "Q1" | "Q2" | "Q3" | "Q4" {
  const isImportant = importanceScore >= settings.importantMin;
  const isUrgent = urgencyScore >= settings.urgentMin;

  if (isImportant && isUrgent) return "Q1";
  if (isImportant && !isUrgent) return "Q2";
  if (!isImportant && isUrgent) return "Q3";
  return "Q4";
}
