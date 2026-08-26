"use client";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-9 w-9" />;

  const icons = {
    light: <Sun className="h-4 w-4" />,
    dark: <Moon className="h-4 w-4" />,
    system: <Monitor className="h-4 w-4" />,
  };

  const next: Record<string, string> = { light: "dark", dark: "system", system: "light" };
  const current = (theme ?? "system") as "light" | "dark" | "system";

  return (
    <button
      onClick={() => setTheme(next[current])}
      className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors"
      title={{ light: "라이트 모드", dark: "다크 모드", system: "시스템 설정" }[current]}
    >
      {icons[current]}
    </button>
  );
}
