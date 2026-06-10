"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useCountUp } from "@/hooks/use-count-up";

/**
 * วงแหวนความคืบหน้า (SVG) + ตัวเลข % นับขึ้นตรงกลาง.
 * เคารพ prefers-reduced-motion (ผ่าน useCountUp + transition motion-safe).
 * tone กำหนดสีวงแหวน (amber/green/red).
 */
export function ProgressRing({
  pct,
  tone = "brand",
  size = 116,
  stroke = 11,
  centerLabel,
  centerSub,
  className,
}: {
  /** % ความคืบหน้า — ตัวเลขกลางวงโชว์ค่าจริง (เกิน 100 ได้), เส้น arc clamp ที่ 100 */
  pct: number;
  tone?: "brand" | "income" | "expense";
  size?: number;
  stroke?: number;
  /** ข้อความหลักกลางวง (ดีฟอลต์ = "NN%") */
  centerLabel?: React.ReactNode;
  centerSub?: React.ReactNode;
  className?: string;
}) {
  // ตัวเลขกลางวง = ค่าจริง (อาจเกิน 100% เช่น ทำเกินเป้า); เส้น arc clamp ที่ 100% ไม่ให้ล้นวง
  const safe = Math.max(0, Number.isFinite(pct) ? pct : 0);
  const animated = useCountUp(safe, { duration: 900 });
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (Math.min(100, animated) / 100) * c;

  const color =
    tone === "income"
      ? "hsl(var(--income))"
      : tone === "expense"
        ? "hsl(var(--expense))"
        : "hsl(var(--accent-brand))";

  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="hsl(var(--foreground) / 0.08)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          className="transition-[stroke-dasharray] duration-300 ease-out motion-reduce:transition-none"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold tabular-nums text-foreground">
          {centerLabel ?? `${Math.round(animated)}%`}
        </span>
        {centerSub ? (
          <span className="mt-0.5 text-[11px] font-medium text-muted-foreground">
            {centerSub}
          </span>
        ) : null}
      </div>
    </div>
  );
}
