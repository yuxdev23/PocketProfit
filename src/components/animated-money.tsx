"use client";

import { cn } from "@/lib/utils";
import { formatMoney, formatSignedMoney } from "@/lib/money";
import { useCountUp } from "@/hooks/use-count-up";

type Tone = "auto" | "income" | "expense" | "neutral";

/**
 * ตัวเลขเงินที่ "นับเลขขึ้น" ตอนโหลด (ใช้กับ hero กำไรวันนี้).
 * - format ผ่าน formatMoney/formatSignedMoney เดิม → คงตรรกะเงิน/สตางค์เป๊ะ
 * - tone="auto": บวก=เขียว ลบ=แดง 0=เทา (รองรับขาดทุน)
 * - signed=true → แสดง +/− นำหน้า (กำไรสุทธิ)
 * - เคารพ prefers-reduced-motion (อยู่ใน useCountUp)
 */
export function AnimatedMoney({
  satang,
  tone = "neutral",
  signed = false,
  className,
  duration = 1000,
}: {
  satang: number;
  tone?: Tone;
  signed?: boolean;
  className?: string;
  duration?: number;
}) {
  const safe = Number.isFinite(satang) ? satang : 0;
  // นับบนหน่วย "บาท" เพื่อความลื่น แล้วคูณกลับเป็นสตางค์ตอน format (คงการปัดเศษเดิม)
  const baht = useCountUp(safe / 100, { duration });
  const shownSatang = Math.round(baht * 100);

  let color = "";
  if (tone === "income") color = "text-income";
  else if (tone === "expense") color = "text-expense";
  else if (tone === "auto") {
    color =
      safe > 0
        ? "text-income"
        : safe < 0
          ? "text-expense"
          : "text-muted-foreground";
  }

  return (
    <span className={cn("tabular-nums", color, className)}>
      {signed ? formatSignedMoney(shownSatang) : formatMoney(shownSatang)}
    </span>
  );
}
