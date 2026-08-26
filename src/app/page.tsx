import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { QuadrantBoard } from "@/components/board/QuadrantBoard";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LogOut, RefreshCcw } from "lucide-react";
import type { TaskWithMeta } from "@/types";

export const dynamic = "force-dynamic";

async function getTasks(userId: string): Promise<TaskWithMeta[]> {
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* 상단 네비게이션 */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/80">
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

      <main className="mx-auto max-w-6xl px-4 py-6">
        {/* 페이지 헤더 */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-xl font-bold">시간 관리 매트릭스</h1>
            <p className="mt-1 text-sm text-slate-500">
              중요도와 기한을 입력하면 Task가 자동으로 사분면에 배치됩니다.
            </p>
          </div>

          {/* 새 Task 버튼은 보드 컴포넌트에서 관리 */}
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <RefreshCcw className="h-3.5 w-3.5" />
            페이지 새로고침 시 실시간 반영
          </div>
        </div>

        {/* 4사분면 보드 */}
        <QuadrantBoard initialTasks={tasks} />

        {/* 하단 설명 */}
        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
            사분면 배치 기준
          </h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { q: "Q2", color: "bg-blue-500", desc: "중요도 ≥7 + 긴급도 <7 → 핵심 투자 (좌상단)" },
              { q: "Q1", color: "bg-red-500", desc: "중요도 ≥7 + 긴급도 ≥7 → 즉시 처리 (우상단)" },
              { q: "Q4", color: "bg-gray-400", desc: "중요도 <7 + 긴급도 <7 → 제거 (좌하단)" },
              { q: "Q3", color: "bg-amber-500", desc: "중요도 <7 + 긴급도 ≥7 → 위임/거절 (우하단)" },
            ].map((item) => (
              <div key={item.q} className="flex items-start gap-2">
                <div className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${item.color}`} />
                <p className="text-xs text-slate-500">{item.desc}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-400">
            긴급도는 기한(Due Date)까지 남은 일수로 자동 계산됩니다.
            중요도(1–10)는 Task 추가 시 직접 입력합니다.
          </p>
        </div>
      </main>
    </div>
  );
}
