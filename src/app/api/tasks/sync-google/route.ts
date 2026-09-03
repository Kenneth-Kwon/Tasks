import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getGoogleClient, parseGoogleDue, toGoogleDue } from "@/lib/google-tasks";
import { calcUrgencyScore, calcQuadrant, calcPriorityRank } from "@/lib/quadrant";
import { refreshUrgencyFromDueDates } from "@/lib/refresh-urgency";

type TasksClient = Awaited<ReturnType<typeof getGoogleClient>>;

type GoogleTaskItem = {
  id?: string | null;
  title?: string | null;
  parent?: string | null;
  status?: string | null;
  due?: string | null;
  notes?: string | null;
};

async function mapPool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  if (items.length === 0) return;
  let index = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = items[index++];
      await fn(current);
    }
  });
  await Promise.all(workers);
}

async function listActiveGoogleTasks(tasksClient: TasksClient, listId: string) {
  const items: GoogleTaskItem[] = [];
  let pageToken: string | undefined;
  do {
    const res = await tasksClient.tasks.list({
      tasklist: listId,
      showCompleted: false,
      maxResults: 100,
      pageToken,
    });
    items.push(...(res.data.items ?? []));
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
  return items;
}

function sameDue(a: Date | null, b: Date | null) {
  return (a?.getTime() ?? null) === (b?.getTime() ?? null);
}

async function syncUser(userId: string) {
  const tasksClient = await getGoogleClient(userId);
  const listsRes = await tasksClient.tasklists.list({ maxResults: 100 });
  const lists = (listsRes.data.items ?? []).filter((list) => list.id);

  const listTasks = await Promise.all(
    lists.map(async (list) => ({
      listId: list.id!,
      tasks: await listActiveGoogleTasks(tasksClient, list.id!),
    }))
  );

  const seenGoogleIds = new Set<string>();
  const incoming: { listId: string; gt: GoogleTaskItem }[] = [];
  for (const { listId, tasks } of listTasks) {
    for (const gt of tasks) {
      if (!gt.id) continue;
      seenGoogleIds.add(gt.id);
      if (!gt.title || gt.parent) continue;
      incoming.push({ listId, gt });
    }
  }

  const locals = await db.task.findMany({ where: { userId } });
  const byGoogleId = new Map(
    locals.filter((task) => task.googleTaskId).map((task) => [task.googleTaskId!, task])
  );

  let imported = 0;
  let updated = 0;
  let removed = 0;
  let pushed = 0;

  const toCreate: {
    userId: string;
    title: string;
    description: string | null;
    importanceScore: number;
    urgencyScore: number;
    quadrant: "Q1" | "Q2" | "Q3" | "Q4";
    priorityRank: number;
    dueDate: Date | null;
    status: "TODO";
    googleTaskId: string;
    googleListId: string;
  }[] = [];
  const toUpdate: { id: string; data: Record<string, unknown> }[] = [];

  for (const { listId, gt } of incoming) {
    const existing = byGoogleId.get(gt.id!);
    const dueDate = parseGoogleDue(gt.due);
    const notes = gt.notes !== undefined && gt.notes !== null ? gt.notes : existing?.description ?? null;

    if (existing) {
      const nextStatus = existing.status === "IN_PROGRESS" ? "IN_PROGRESS" : "TODO";
      const dueChanged = !sameDue(existing.dueDate, dueDate);
      const newUrgency = dueChanged ? calcUrgencyScore(dueDate) : existing.urgencyScore;
      const unchanged =
        existing.title === gt.title &&
        existing.description === notes &&
        !dueChanged &&
        existing.status === nextStatus &&
        existing.googleListId === listId;
      if (unchanged) continue;

      toUpdate.push({
        id: existing.id,
        data: {
          title: gt.title!,
          description: notes,
          dueDate,
          urgencyScore: newUrgency,
          quadrant: calcQuadrant(existing.importanceScore, newUrgency),
          priorityRank: calcPriorityRank(existing.importanceScore, newUrgency),
          status: nextStatus,
          googleListId: listId,
        },
      });
      continue;
    }

    const urgencyScore = calcUrgencyScore(dueDate);
    toCreate.push({
      userId,
      title: gt.title!,
      description: notes,
      importanceScore: 5,
      urgencyScore,
      quadrant: calcQuadrant(5, urgencyScore),
      priorityRank: calcPriorityRank(5, urgencyScore),
      dueDate,
      status: "TODO",
      googleTaskId: gt.id!,
      googleListId: listId,
    });
  }

  if (toUpdate.length > 0) {
    await mapPool(toUpdate, 8, async (item) => {
      await db.task.update({ where: { id: item.id }, data: item.data });
    });
    updated = toUpdate.length;
  }

  if (toCreate.length > 0) {
    await db.task.createMany({ data: toCreate });
    imported = toCreate.length;
  }

  const missing = locals.filter(
    (task) => task.googleTaskId && task.googleListId && !seenGoogleIds.has(task.googleTaskId)
  );
  const toRemove: string[] = [];

  await mapPool(missing, 6, async (task) => {
    if (task.status === "DONE") return;
    try {
      const remote = await tasksClient.tasks.get({
        tasklist: task.googleListId!,
        task: task.googleTaskId!,
      });
      if (remote.data.status === "completed") {
        await db.task.update({
          where: { id: task.id },
          data: { status: "DONE", title: remote.data.title ?? task.title },
        });
        updated++;
        return;
      }
      if (remote.data.deleted) {
        toRemove.push(task.id);
      }
    } catch {
      toRemove.push(task.id);
    }
  });

  if (toRemove.length > 0) {
    await db.task.deleteMany({ where: { userId, id: { in: toRemove } } });
    removed = toRemove.length;
  }

  const pushList =
    lists.find((list) =>
      ["기타", "Other", "other", "기타 (Other)"].includes(list.title ?? "")
    ) ?? lists[0];

  if (pushList?.id) {
    const localOnly = locals.filter((task) => !task.googleTaskId && task.status !== "DONE");
    await mapPool(localOnly, 4, async (lt) => {
      try {
        const created = await tasksClient.tasks.insert({
          tasklist: pushList.id!,
          requestBody: {
            title: lt.title,
            notes: lt.description ?? undefined,
            due: toGoogleDue(lt.dueDate),
          },
        });
        if (created.data.id) {
          await db.task.update({
            where: { id: lt.id },
            data: { googleTaskId: created.data.id, googleListId: pushList.id },
          });
          pushed++;
        }
      } catch {
        /* 무시 */
      }
    });
  }

  const refreshed = await refreshUrgencyFromDueDates(userId);
  return { imported, updated, removed, pushed, refreshed };
}

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
      message: `동기화 완료 — 가져옴 ${result.imported}, 갱신 ${result.updated}, 삭제 ${result.removed}, 내보냄 ${result.pushed}`,
    });
  } catch (err) {
    const raw = err instanceof Error ? err.message : "알 수 없는 오류";
    const message = raw.toLowerCase().includes("invalid_grant")
      ? "Google 권한이 만료되었습니다. 로그아웃 후 Google로 다시 로그인해 주세요."
      : raw;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await db.user.findMany({
    where: { accounts: { some: { provider: "google" } } },
    select: { id: true },
  });

  const results = await Promise.allSettled(users.map((u) => syncUser(u.id)));
  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  return NextResponse.json({ synced: succeeded, total: users.length });
}
