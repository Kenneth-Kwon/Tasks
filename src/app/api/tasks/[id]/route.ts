import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  calcUrgencyScore,
  calcQuadrant,
  calcPriorityRank,
} from "@/lib/quadrant";
import { z } from "zod";

const UpdateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  importanceScore: z.number().int().min(1).max(10).optional(),
  dueDate: z.string().datetime().optional().nullable(),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).optional(),
});

async function getTaskForUser(taskId: string, userId: string) {
  return db.task.findFirst({ where: { id: taskId, userId } });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await getTaskForUser(id, session.user.id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = UpdateTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { title, description, importanceScore, dueDate, status } = parsed.data;

  const newImportance = importanceScore ?? existing.importanceScore;
  const newDueDate =
    dueDate !== undefined
      ? dueDate
        ? new Date(dueDate)
        : null
      : existing.dueDate;

  const urgencyScore = calcUrgencyScore(newDueDate);
  const quadrant = calcQuadrant(newImportance, urgencyScore);
  const priorityRank = calcPriorityRank(newImportance, urgencyScore);

  const task = await db.task.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      importanceScore: newImportance,
      urgencyScore,
      quadrant,
      priorityRank,
      dueDate: newDueDate,
      ...(status !== undefined && { status }),
    },
  });

  return NextResponse.json(task);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await getTaskForUser(id, session.user.id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.task.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
