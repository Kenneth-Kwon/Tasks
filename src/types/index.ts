import type { Quadrant, TaskStatus } from "@prisma/client";

export type { Quadrant, TaskStatus };

export interface TaskWithMeta {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  importanceScore: number;
  urgencyScore: number;
  quadrant: Quadrant;
  priorityRank: number;
  status: TaskStatus;
  dueDate: string | null;
  googleTaskId: string | null;
  notifyAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  importanceScore: number;
  dueDate?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  importanceScore?: number;
  dueDate?: string;
  status?: TaskStatus;
}
