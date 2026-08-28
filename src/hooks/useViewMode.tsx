"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type ViewMode = "simple" | "detail";

const VIEW_MODE_KEY = "focusmatrix_view_mode";

interface ViewModeContextValue {
  mode: ViewMode;
  isSimple: boolean;
  setMode: (mode: ViewMode) => void;
  toggle: () => void;
}

const ViewModeContext = createContext<ViewModeContextValue | null>(null);

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ViewMode>("detail");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(VIEW_MODE_KEY);
      if (stored === "simple" || stored === "detail") setModeState(stored);
    } catch {
      /* ignore */
    }
  }, []);

  const setMode = useCallback((next: ViewMode) => {
    setModeState(next);
    try {
      localStorage.setItem(VIEW_MODE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(() => {
    setMode(mode === "simple" ? "detail" : "simple");
  }, [mode, setMode]);

  return (
    <ViewModeContext.Provider value={{ mode, isSimple: mode === "simple", setMode, toggle }}>
      {children}
    </ViewModeContext.Provider>
  );
}

export function useViewMode() {
  const ctx = useContext(ViewModeContext);
  if (!ctx) {
    throw new Error("useViewMode must be used within ViewModeProvider");
  }
  return ctx;
}
