import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { calcUrgencyScore, calcQuadrant, calcPriorityRank } from "@/lib/quadrant";
import { getGoogleClient, toGoogleDue } from "@/lib/google-tasks";
import { z } from "zod";

const CreateTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  importanceScore: z.number().int().min(1).max(10),
  urgencyScore: z.number().int().min(1).max(10).optional(),
  dueDate: z.string().datetime().optional().nullable(),
  googleListId: z.string().optional().nullable(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tasks = await db.task.findMany({
    where: { userId: session.user.id },
    orderBy: [{ quadrant: "asc" }, { priorityRank: "desc" }],
  });

  return NextResponse.json(tasks);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = CreateTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  const { title, description, importanceScore, urgencyScore: urgencyOverride, dueDate, googleListId } = parsed.data;
  const parsedDueDate = dueDate ? new Date(dueDate) : null;
  const urgencyScore = urgencyOverride ?? calcUrgencyScore(parsedDueDate);
  const quadrant = calcQuadrant(importanceScore, urgencyScore);
  const priorityRank = calcPriorityRank(importanceScore, urgencyScore);

  // 해당 사분면 최상단(sortOrder 최대값)보다 10000 높게 설정 → 새 task가 맨 위에 추가됨
  const topTask = await db.task.findFirst({
    where: { userId: session.user.id, quadrant },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  const sortOrder = (topTask?.sortOrder ?? 0) + 10000;

  const task = await db.task.create({
    data: {
      userId: session.user.id,
      title,
      description: description ?? null,
      importanceScore,
      urgencyScore,
      quadrant,
      priorityRank,
      sortOrder,
      dueDate: parsedDueDate,
    },
  });

  // Google Tasks 자동 반영
  try {
    const tasksClient = await getGoogleClient(session.user.id);

    let targetListId = googleListId ?? null;

    // 목록 ID가 없으면 "기타" 목록 자동 탐색
    if (!targetListId) {
      const listsRes = await tasksClient.tasklists.list({ maxResults: 20 });
      const lists = listsRes.data.items ?? [];
      const kita = lists.find((l) =>
        ["기타", "Other", "other", "기타 (Other)"].includes(l.title ?? "")
      );
      if (!kita) {
        // "기타" 목록 없음 — Task는 저장됐으나 Google 미반영
        return NextResponse.json(
          { ...task, googleError: '"기타" Google Task 목록이 존재하지 않습니다.' },
          { status: 201 }
        );
      }
      targetListId = kita.id!;
    }

    const created = await tasksClient.tasks.insert({
      tasklist: targetListId,
      requestBody: { title, notes: description ?? undefined, due: toGoogleDue(parsedDueDate) },
    });
    if (created.data.id) {
      await db.task.update({
        where: { id: task.id },
        data: { googleTaskId: created.data.id, googleListId: targetListId },
      });
      task.googleTaskId = created.data.id;
      task.googleListId = targetListId;
    }
  } catch { /* Google 연동 실패 무시 */ }

  return NextResponse.json(task, { status: 201 });
}
