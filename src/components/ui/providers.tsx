"use client";
import { ThemeProvider } from "next-themes";
import { ViewModeProvider } from "@/hooks/useViewMode";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <ViewModeProvider>{children}</ViewModeProvider>
    </ThemeProvider>
  );
}
