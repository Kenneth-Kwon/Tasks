import { db } from "@/lib/db";
import { calcUrgencyScore, calcQuadrant, calcPriorityRank } from "@/lib/quadrant";

/** 기한이 있는 미완료 Task의 긴급도·사분면을 오늘 기준으로 다시 계산한다. */
export async function refreshUrgencyFromDueDates(userId: string): Promise<number> {
  const tasks = await db.task.findMany({
    where: {
      userId,
      dueDate: { not: null },
      status: { not: "DONE" },
    },
    select: {
      id: true,
      dueDate: true,
      importanceScore: true,
      urgencyScore: true,
      quadrant: true,
      priorityRank: true,
    },
  });

  const stale = tasks.flatMap((task) => {
    const urgencyScore = calcUrgencyScore(task.dueDate);
    const quadrant = calcQuadrant(task.importanceScore, urgencyScore);
    const priorityRank = calcPriorityRank(task.importanceScore, urgencyScore);
    if (
      urgencyScore === task.urgencyScore &&
      quadrant === task.quadrant &&
      priorityRank === task.priorityRank
    ) {
      return [];
    }
    return [{ id: task.id, data: { urgencyScore, quadrant, priorityRank } }];
  });

  await Promise.all(
    stale.map((item) => db.task.update({ where: { id: item.id }, data: item.data }))
  );

  return stale.length;
}
