import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getGoogleClient } from "@/lib/google-tasks";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const tasksClient = await getGoogleClient(session.user.id);
    const res = await tasksClient.tasklists.list({ maxResults: 20 });
    const lists = (res.data.items ?? []).map((l) => ({
      id: l.id!,
      title: l.title ?? "(제목 없음)",
    }));
    return NextResponse.json(lists);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
