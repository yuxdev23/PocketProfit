"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * ปุ่มสลับโหมดสว่าง/มืด — persist ผ่าน next-themes (localStorage "theme").
 * กัน hydration mismatch ด้วยการ render ไอคอนหลัง mount.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  // ก่อน mount ให้ "นิ่ง" เหมือน SSR (light) เพื่อกัน hydration mismatch ของ aria-label/onClick.
  const isDark = mounted && resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => mounted && setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "สลับเป็นโหมดสว่าง" : "สลับเป็นโหมดมืด"}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-card/60 text-foreground/80 transition-all hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-90",
        className,
      )}
    >
      {/* render ไอคอนหลัง mount เท่านั้น (กัน mismatch); ก่อนหน้านั้นเว้นช่องว่างขนาดเท่ากัน */}
      {!mounted ? (
        <span className="h-[18px] w-[18px]" />
      ) : isDark ? (
        <Moon className="h-[18px] w-[18px]" />
      ) : (
        <Sun className="h-[18px] w-[18px]" />
      )}
    </button>
  );
}
