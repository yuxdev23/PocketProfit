"use client";

import * as React from "react";

/**
 * นับเลขขึ้น (count-up) จาก 0 → target ตอน mount.
 * - เคารพ prefers-reduced-motion → ข้ามอนิเมชัน แสดงค่าปลายทางทันที
 * - ease-out cubic ให้ความรู้สึก "นุ่ม-หยุดสวย"
 * - คืนค่าเป็น "ตัวเลข" ปัจจุบัน (ผู้เรียก format เอง → คงตรรกะเงิน/สตางค์เดิมไว้)
 */
export function useCountUp(
  target: number,
  { duration = 900, enabled = true }: { duration?: number; enabled?: boolean } = {},
): number {
  const [value, setValue] = React.useState(enabled ? 0 : target);
  const frame = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (!enabled) {
      setValue(target);
      return;
    }

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReduced || target === 0) {
      setValue(target);
      return;
    }

    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(from + (target - from) * eased);
      if (t < 1) {
        frame.current = requestAnimationFrame(tick);
      } else {
        setValue(target);
      }
    };
    frame.current = requestAnimationFrame(tick);

    return () => {
      if (frame.current != null) cancelAnimationFrame(frame.current);
    };
  }, [target, duration, enabled]);

  return value;
}
