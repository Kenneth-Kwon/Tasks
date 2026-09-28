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
      if (!gt.id || !gt.title) continue;
      seenGoogleIds.add(gt.id);
      incoming.push({ listId, gt });
    }
  }

  let locals = await db.task.findMany({ where: { userId } });
  let byGoogleId = new Map(
    locals.filter((task) => task.googleTaskId).map((task) => [task.googleTaskId!, task])
  );

  let imported = 0;
  let updated = 0;
  let removed = 0;
  let pushed = 0;

  type CreateRow = {
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
    parentId?: string | null;
    sortOrder?: number;
  };
  const toCreate: CreateRow[] = [];
  const toUpdate: { id: string; data: Record<string, unknown> }[] = [];

  function collectItem(
    listId: string,
    gt: GoogleTaskItem,
    parentId: string | null,
    sortOrder: number
  ) {
    const existing = byGoogleId.get(gt.id!);
    const dueDate = parseGoogleDue(gt.due);
    const notes = gt.notes !== undefined && gt.notes !== null ? gt.notes : existing?.description ?? null;
    const importanceScore = existing?.importanceScore ?? 5;
    const urgencyScore = existing && !dueDate
      ? existing.urgencyScore
      : existing && sameDue(existing.dueDate, dueDate)
        ? existing.urgencyScore
        : calcUrgencyScore(dueDate);

    if (existing) {
      const nextStatus = existing.status === "IN_PROGRESS" ? "IN_PROGRESS" : "TODO";
      const unchanged =
        existing.title === gt.title &&
        existing.description === notes &&
        sameDue(existing.dueDate, dueDate) &&
        existing.status === nextStatus &&
        existing.googleListId === listId &&
        existing.parentId === parentId;
      if (unchanged) return;

      toUpdate.push({
        id: existing.id,
        data: {
          title: gt.title!,
          description: notes,
          dueDate,
          urgencyScore,
          quadrant: calcQuadrant(importanceScore, urgencyScore),
          priorityRank: calcPriorityRank(importanceScore, urgencyScore),
          status: nextStatus,
          googleListId: listId,
          parentId,
          ...(parentId ? { sortOrder } : {}),
        },
      });
      return;
    }

    toCreate.push({
      userId,
      title: gt.title!,
      description: notes,
      importanceScore,
      urgencyScore,
      quadrant: calcQuadrant(importanceScore, urgencyScore),
      priorityRank: calcPriorityRank(importanceScore, urgencyScore),
      dueDate,
      status: "TODO",
      googleTaskId: gt.id!,
      googleListId: listId,
      parentId,
      sortOrder,
    });
  }

  const roots = incoming.filter((item) => !item.gt.parent);
  const children = incoming.filter((item) => item.gt.parent);

  roots.forEach((item, index) => collectItem(item.listId, item.gt, null, (index + 1) * 10000));

  if (toUpdate.length > 0) {
    await mapPool(toUpdate, 8, async (item) => {
      await db.task.update({ where: { id: item.id }, data: item.data });
    });
    updated += toUpdate.length;
    toUpdate.length = 0;
  }

  if (toCreate.length > 0) {
    await db.task.createMany({ data: toCreate });
    imported += toCreate.length;
    toCreate.length = 0;
  }

  locals = await db.task.findMany({ where: { userId } });
  byGoogleId = new Map(
    locals.filter((task) => task.googleTaskId).map((task) => [task.googleTaskId!, task])
  );

  const childIndex = new Map<string, number>();
  children.forEach((item) => {
    const parent = byGoogleId.get(item.gt.parent!);
    if (!parent) return;
    const n = (childIndex.get(parent.id) ?? 0) + 1;
    childIndex.set(parent.id, n);
    collectItem(item.listId, item.gt, parent.id, n * 10000);
  });

  if (toUpdate.length > 0) {
    await mapPool(toUpdate, 8, async (item) => {
      await db.task.update({ where: { id: item.id }, data: item.data });
    });
    updated += toUpdate.length;
  }

  if (toCreate.length > 0) {
    await db.task.createMany({ data: toCreate });
    imported += toCreate.length;
  }

  locals = await db.task.findMany({ where: { userId } });

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
    const pushOne = async (lt: (typeof localOnly)[number], parentGoogleId?: string) => {
      try {
        const created = await tasksClient.tasks.insert({
          tasklist: pushList.id!,
          ...(parentGoogleId ? { parent: parentGoogleId } : {}),
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
          lt.googleTaskId = created.data.id;
          pushed++;
        }
      } catch {
        /* 무시 */
      }
    };

    const localRoots = localOnly.filter((task) => !task.parentId);
    await mapPool(localRoots, 4, (lt) => pushOne(lt));

    const localChildren = localOnly.filter((task) => task.parentId);
    await mapPool(localChildren, 4, async (lt) => {
      const parent =
        locals.find((task) => task.id === lt.parentId) ??
        (await db.task.findFirst({ where: { id: lt.parentId!, userId } }));
      if (!parent?.googleTaskId) return;
      await pushOne(lt, parent.googleTaskId);
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
