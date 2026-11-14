"use client";

import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Light/dark switch with a circular reveal from the button (View Transitions
 * API; keyframes in globals.css). Browsers without it, or with reduced
 * motion on, just switch.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();

  function toggle(event: React.MouseEvent<HTMLButtonElement>) {
    const next = resolvedTheme === "dark" ? "light" : "dark";
    const root = document.documentElement;
    // next-themes applies the class in an effect, too late for the snapshot;
    // set it here as well (same classes it would set).
    const apply = () => {
      root.classList.remove("light", "dark");
      root.classList.add(next);
      root.style.colorScheme = next;
      setTheme(next);
    };

    if (!document.startViewTransition || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      apply();
      return;
    }

    // Keyboard clicks report (0,0): start from the button's centre instead.
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = event.clientX || bounds.left + bounds.width / 2;
    const y = event.clientY || bounds.top + bounds.height / 2;
    root.style.setProperty("--vt-x", `${x}px`);
    root.style.setProperty("--vt-y", `${y}px`);
    root.style.setProperty(
      "--vt-r",
      `${Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))}px`,
    );
    // Dark to light plays in reverse: the dark view shrinks back into the button.
    root.classList.toggle("vt-reverse", next === "light");
    document.startViewTransition(apply).finished.finally(() => root.classList.remove("vt-reverse"));
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label="Toggle theme"
      className={cn(className)}
    >
      <Sun className="size-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute size-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </Button>
  );
}
