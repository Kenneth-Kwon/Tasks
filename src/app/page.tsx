import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { BoardPageBody } from "@/components/board/BoardPageBody";
import { ViewModeFrame } from "@/components/board/ViewModeFrame";
import { ViewModeToggle } from "@/components/board/ViewModeToggle";
import { LayoutModeToggle } from "@/components/board/LayoutModeToggle";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LogOut } from "lucide-react";
import { refreshUrgencyFromDueDates } from "@/lib/refresh-urgency";
import type { TaskWithMeta } from "@/types";

export const dynamic = "force-dynamic";

async function getTasks(userId: string): Promise<TaskWithMeta[]> {
  await refreshUrgencyFromDueDates(userId);

  const tasks = await db.task.findMany({
    where: { userId },
    orderBy: [{ quadrant: "asc" }, { priorityRank: "desc" }],
  });

  return tasks.map((t) => ({
    ...t,
    dueDate: t.dueDate ? t.dueDate.toISOString() : null,
    notifyAt: t.notifyAt ? t.notifyAt.toISOString() : null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }));
}

export default async function HomePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const tasks = await getTasks(session.user.id);

  const q1 = tasks.filter((t) => t.quadrant === "Q1" && t.status !== "DONE").length;
  const q2 = tasks.filter((t) => t.quadrant === "Q2" && t.status !== "DONE").length;
  const totalDone = tasks.filter((t) => t.status === "DONE").length;

  return (
    <ViewModeFrame>
      <header className="sticky top-0 z-30 shrink-0 border-b border-slate-200 bg-white/80 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          {/* 로고 */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 dark:bg-slate-50">
              <svg
                className="h-4 w-4 text-white dark:text-slate-900"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <rect x="3" y="3" width="7" height="7" rx="0.5" />
                <rect x="14" y="3" width="7" height="7" rx="0.5" />
                <rect x="3" y="14" width="7" height="7" rx="0.5" />
                <rect x="14" y="14" width="7" height="7" rx="0.5" />
              </svg>
            </div>
            <span className="text-base font-bold">FocusMatrix</span>
          </div>

          <div className="flex-1" />

          {/* 통계 */}
          <div className="hidden sm:flex items-center gap-4 text-xs text-slate-500">
            {q1 > 0 && (
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                Q1 긴급 {q1}건
              </span>
            )}
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              Q2 핵심 {q2}건
            </span>
            <span>완료 {totalDone}건</span>
          </div>

          {/* 사용자 */}
          <div className="flex items-center gap-1.5">
            <LayoutModeToggle />
            <ViewModeToggle />
            <ThemeToggle />
            {session.user.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={session.user.image}
                alt={session.user.name ?? ""}
                className="h-7 w-7 rounded-full"
              />
            )}
            <span className="hidden sm:block text-sm font-medium">
              {session.user.name?.split(" ")[0]}
            </span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button
                type="submit"
                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 transition-colors"
                title="로그아웃"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </header>

      <BoardPageBody initialTasks={tasks} />
    </ViewModeFrame>
  );
}
