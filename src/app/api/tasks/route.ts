import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  calcUrgencyScore,
  calcQuadrant,
  calcPriorityRank,
} from "@/lib/quadrant";
import { z } from "zod";

const CreateTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  importanceScore: z.number().int().min(1).max(10),
  dueDate: z.string().datetime().optional().nullable(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tasks = await db.task.findMany({
    where: { userId: session.user.id, status: { not: "DONE" } },
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
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { title, description, importanceScore, dueDate } = parsed.data;
  const parsedDueDate = dueDate ? new Date(dueDate) : null;
  const urgencyScore = calcUrgencyScore(parsedDueDate);
  const quadrant = calcQuadrant(importanceScore, urgencyScore);
  const priorityRank = calcPriorityRank(importanceScore, urgencyScore);

  const task = await db.task.create({
    data: {
      userId: session.user.id,
      title,
      description: description ?? null,
      importanceScore,
      urgencyScore,
      quadrant,
      priorityRank,
      dueDate: parsedDueDate,
    },
  });

  return NextResponse.json(task, { status: 201 });
}
