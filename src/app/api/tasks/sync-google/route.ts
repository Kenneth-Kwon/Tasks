import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getGoogleClient, parseGoogleDue, toGoogleDue, starredToImportance } from "@/lib/google-tasks";
import { calcUrgencyScore, calcQuadrant, calcPriorityRank } from "@/lib/quadrant";

// 단일 사용자 동기화 로직
async function syncUser(userId: string) {
  const tasksClient = await getGoogleClient(userId);
  const listsRes = await tasksClient.tasklists.list({ maxResults: 20 });
  const lists = listsRes.data.items ?? [];

  let imported = 0, updated = 0, pushed = 0;

  for (const list of lists) {
    if (!list.id) continue;
    const listId = list.id;

    // 미완료 Task만 가져오기
    const activeRes = await tasksClient.tasks.list({
      tasklist: listId,
      showCompleted: false,
      maxResults: 100,
    });
    const allGoogleTasks = activeRes.data.items ?? [];

    for (const gt of allGoogleTasks) {
      if (!gt.id || !gt.title) continue;
      if (gt.parent) continue; // 하위 항목 제외

      const dueDate = parseGoogleDue(gt.due);
      const starred = gt.starred ?? false;
      const importanceScore = starredToImportance(starred);
      const urgencyScore = calcUrgencyScore(dueDate);
      const quadrant = calcQuadrant(importanceScore, urgencyScore);
      const priorityRank = calcPriorityRank(importanceScore, urgencyScore);

      const existing = await db.task.findFirst({
        where: { userId, googleTaskId: gt.id },
      });

      if (existing) {
        const newImportance = existing.importanceScore !== 5
          ? existing.importanceScore
          : importanceScore;
        await db.task.update({
          where: { id: existing.id },
          data: {
            title: gt.title,
            description: gt.notes ?? existing.description,
            dueDate,
            urgencyScore: calcUrgencyScore(dueDate),
            quadrant: calcQuadrant(newImportance, calcUrgencyScore(dueDate)),
            priorityRank: calcPriorityRank(newImportance, calcUrgencyScore(dueDate)),
            status: "TODO",
            googleListId: listId,
          },
        });
        updated++;
      } else {
        await db.task.create({
          data: {
            userId,
            title: gt.title,
            description: gt.notes ?? null,
            importanceScore,
            urgencyScore,
            quadrant,
            priorityRank,
            dueDate,
            status: "TODO",
            googleTaskId: gt.id,
            googleListId: listId,
          },
        });
        imported++;
      }
    }

    // 앱에만 있는 Task → Google push
    const localOnly = await db.task.findMany({
      where: { userId, googleTaskId: null, status: { not: "DONE" } },
    });
    for (const lt of localOnly) {
      try {
        const created = await tasksClient.tasks.insert({
          tasklist: listId,
          requestBody: {
            title: lt.title,
            notes: lt.description ?? undefined,
            due: toGoogleDue(lt.dueDate),
          },
        });
        if (created.data.id) {
          await db.task.update({
            where: { id: lt.id },
            data: { googleTaskId: created.data.id, googleListId: listId },
          });
          pushed++;
        }
      } catch { /* 무시 */ }
    }
    break; // 앱 Task는 첫 번째 목록에만 push
  }

  return { imported, updated, pushed };
}

// 버튼 클릭 / 자동 호출 (로그인된 사용자)
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncUser(session.user.id);
    return NextResponse.json({
      success: true,
      ...result,
      message: `동기화 완료 — ${result.imported}개 가져옴, ${result.updated}개 갱신, ${result.pushed}개 내보냄`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Vercel Cron 전용 — 모든 사용자 자동 동기화 (15분마다)
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await db.user.findMany({
    where: { accounts: { some: { provider: "google" } } },
    select: { id: true },
  });

  const results = await Promise.allSettled(
    users.map((u) => syncUser(u.id))
  );

  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  return NextResponse.json({ synced: succeeded, total: users.length });
}
