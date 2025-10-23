"use client";

import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof document === "undefined") return "light";
    return document.documentElement.classList.contains("dark") ? "dark" : "light";
  });

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setTheme(isDark ? "dark" : "light");
  }, []);

  const toggle = useCallback(() => {
    const root = document.documentElement;
    const nextIsDark = !root.classList.contains("dark");
    root.classList.toggle("dark", nextIsDark);
    const next: Theme = nextIsDark ? "dark" : "light";
    try { localStorage.setItem("theme", next); } catch {}
    setTheme(next);
  }, []);

  const set = useCallback((t: Theme) => {
    const root = document.documentElement;
    const isDark = t === "dark";
    root.classList.toggle("dark", isDark);
    try { localStorage.setItem("theme", t); } catch {}
    setTheme(t);
  }, []);

  return { theme, isDark: theme === "dark", toggle, set };
}
