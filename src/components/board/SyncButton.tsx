"use client";
import { useState } from "react";
import { RefreshCcw, CheckCircle2, AlertCircle } from "lucide-react";

interface SyncResult {
  success: boolean;
  message?: string;
  error?: string;
}

export function SyncButton({ onSynced }: { onSynced?: () => void }) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSync() {
    setStatus("loading");
    try {
      const res = await fetch("/api/tasks/sync-google", { method: "POST" });
      const data: SyncResult = await res.json();
      if (data.success) {
        setStatus("success");
        setMessage(data.message ?? "동기화 완료");
        onSynced?.();
        setTimeout(() => setStatus("idle"), 3000);
      } else {
        setStatus("error");
        setMessage(data.error ?? "동기화 실패");
        setTimeout(() => setStatus("idle"), 4000);
      }
    } catch {
      setStatus("error");
      setMessage("네트워크 오류");
      setTimeout(() => setStatus("idle"), 4000);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleSync}
        disabled={status === "loading"}
        className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-all"
        title="Google Tasks 동기화"
      >
        <RefreshCcw className={`h-3.5 w-3.5 ${status === "loading" ? "animate-spin" : ""}`} />
        Google Tasks 동기화
      </button>

      {status === "success" && (
        <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5" /> {message}
        </span>
      )}
      {status === "error" && (
        <span className="flex items-center gap-1 text-xs text-red-500">
          <AlertCircle className="h-3.5 w-3.5" /> {message}
        </span>
      )}
    </div>
  );
}
