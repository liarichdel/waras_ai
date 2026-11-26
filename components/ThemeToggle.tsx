"use client";

import { Moon, Sun } from "lucide-react";

// Stateless on purpose: the theme lives on <html data-theme>, so the icon swap is pure CSS and never mismatches on hydration.
export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      // storage blocked (private mode); the switch still works for this visit
    }
  }

  return (
    <button
      onClick={toggle}
      aria-label="Ganti mode terang / gelap"
      title="Ganti mode terang / gelap"
      className="flex size-9 shrink-0 items-center justify-center border border-line text-ink hover:bg-line"
    >
      <Sun size={16} strokeWidth={2} className="hidden dark:block" />
      <Moon size={16} strokeWidth={2} className="dark:hidden" />
    </button>
  );
}
