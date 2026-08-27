"use client";
import { useState, useEffect, useCallback } from "react";
import { type QuadrantSettings, DEFAULT_SETTINGS, SETTINGS_KEY } from "@/lib/settings";

export function useSettings() {
  const [settings, setSettings] = useState<QuadrantSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      if (stored) {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) });
      }
    } catch {
      // localStorage 접근 불가 시 기본값 사용
    }
    setLoaded(true);
  }, []);

  const save = useCallback((next: QuadrantSettings) => {
    setSettings(next);
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    } catch { /* 무시 */ }
  }, []);

  return { settings, save, loaded };
}
