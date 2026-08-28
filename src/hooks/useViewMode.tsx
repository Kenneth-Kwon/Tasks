"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type ViewMode = "simple" | "detail";
export type LayoutMode = "list" | "matrix";

const VIEW_MODE_KEY = "focusmatrix_view_mode";
const LAYOUT_MODE_KEY = "focusmatrix_layout_mode";

interface ViewModeContextValue {
  mode: ViewMode;
  isSimple: boolean;
  setMode: (mode: ViewMode) => void;
  toggle: () => void;
  layout: LayoutMode;
  isMatrix: boolean;
  setLayout: (layout: LayoutMode) => void;
  toggleLayout: () => void;
}

const ViewModeContext = createContext<ViewModeContextValue | null>(null);

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ViewMode>("detail");
  const [layout, setLayoutState] = useState<LayoutMode>("list");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(VIEW_MODE_KEY);
      if (stored === "simple" || stored === "detail") setModeState(stored);
      const storedLayout = localStorage.getItem(LAYOUT_MODE_KEY);
      if (storedLayout === "list" || storedLayout === "matrix") setLayoutState(storedLayout);
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

  const setLayout = useCallback((next: LayoutMode) => {
    setLayoutState(next);
    try {
      localStorage.setItem(LAYOUT_MODE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(() => {
    setMode(mode === "simple" ? "detail" : "simple");
  }, [mode, setMode]);

  const toggleLayout = useCallback(() => {
    setLayout(layout === "list" ? "matrix" : "list");
  }, [layout, setLayout]);

  return (
    <ViewModeContext.Provider
      value={{
        mode,
        isSimple: mode === "simple",
        setMode,
        toggle,
        layout,
        isMatrix: layout === "matrix",
        setLayout,
        toggleLayout,
      }}
    >
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
