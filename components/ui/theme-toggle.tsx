"use client";

import { useState, useEffect } from "react";
import { Moon, Sun } from "lucide-react";

/**
 * Theme toggle — switches between light and dark mode.
 * Persists choice in localStorage and applies the `dark` class to <html>.
 * Safe: only toggles a CSS class, no app logic touched.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("bakesync-theme");
    const initial = stored === "dark" ? "dark" : "light";
    setTheme(initial);
    document.documentElement.classList.toggle("dark", initial === "dark");
  }, []);

  function toggle() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("bakesync-theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
  }

  // Avoid hydration mismatch — render a placeholder until mounted
  if (!mounted) {
    return <div className="w-9 h-9" aria-hidden="true" />;
  }

  return (
    <button
      onClick={toggle}
      className="p-2 rounded-lg hover:bg-muted transition-colors tap-target text-muted-foreground hover:text-foreground"
      aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
      title={theme === "light" ? "Dark mode" : "Light mode"}
    >
      {theme === "light" ? (
        <Moon className="w-5 h-5" />
      ) : (
        <Sun className="w-5 h-5" />
      )}
    </button>
  );
}
