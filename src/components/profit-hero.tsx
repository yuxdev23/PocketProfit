"use client";

import { TrendingUp, TrendingDown, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AnimatedMoney } from "@/components/animated-money";
import { StatPill } from "@/components/stat-pill";
import { cn } from "@/lib/utils";

/**
 * Hero "กำไรวันนี้" — ศูนย์กลางอารมณ์ของแอป.
 * - การ์ดคลีน (พื้น card, ขอบสีตามกำไร/ขาดทุน) สไตล์เดียวกับการ์ดเป้า /goals, ตัวเลขกำไร "ใหญ่มาก" + count-up
 * - สีเขียว(กำไร)/แดง(ขาดทุน) + ป้ายสถานะ + ประโยคให้กำลังใจไทย
 * - เทียบกับเมื่อวานเพื่อบอกอารมณ์ (ดีกว่า/น้อยกว่า)
 * - ใต้การ์ด: พิลล์ รายรับ / รายจ่าย
 */
export function ProfitHero({
  label,
  profitSatang,
  incomeSatang,
  expenseSatang,
  yesterdayProfitSatang,
  isToday = true,
  incomeHref,
  expenseHref,
}: {
  label: string;
  profitSatang: number;
  incomeSatang: number;
  expenseSatang: number;
  yesterdayProfitSatang?: number | null;
  isToday?: boolean;
  /** ถ้ามี → พิลล์รายรับ/รายจ่ายจะมีไอคอนลิงก์ไปดูรายการของวันนั้น */
  incomeHref?: string;
  expenseHref?: string;
}) {
  const isProfit = profitSatang > 0;
  const isLoss = profitSatang < 0;

  // ประโยคสถานะ — อบอุ่น ให้กำลังใจ
  let status: { emoji: string; text: string };
  if (isLoss) {
    status = { emoji: "🌱", text: "วันนี้ขาดทุน ไม่เป็นไร พรุ่งนี้สู้ใหม่" };
  } else if (profitSatang === 0) {
    status = { emoji: "🙂", text: "วันนี้ยังไม่มีกำไร ค่อยๆ ไปด้วยกันนะ" };
  } else if (
    isToday &&
    yesterdayProfitSatang != null &&
    profitSatang > yesterdayProfitSatang
  ) {
    status = { emoji: "😊", text: "ดีกว่าเมื่อวาน เก่งมาก" };
  } else if (
    isToday &&
    yesterdayProfitSatang != null &&
    profitSatang < yesterdayProfitSatang &&
    yesterdayProfitSatang > 0
  ) {
    status = { emoji: "💪", text: "วันนี้ยังมีกำไร สู้ๆ ต่อนะ" };
  } else {
    status = { emoji: "🎉", text: "วันนี้มีกำไร เยี่ยมไปเลย" };
  }

  return (
    <div className="space-y-3">
      <div
        className={cn(
          // การ์ดขาวคลีน เด่นด้วย "เงายกตัว" (elevation) มากกว่าการ์ดอื่น — ไม่ใช้สีพื้น
          "rounded-3xl border bg-card p-6 shadow-warm-glow",
          isProfit ? "border-income/25" : isLoss ? "border-expense/30" : "border-border",
          "animate-fade-slide-up",
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full",
                isProfit
                  ? "bg-income-soft text-income"
                  : isLoss
                    ? "bg-expense-soft text-expense"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {isProfit ? (
                <TrendingUp className="h-5 w-5" />
              ) : isLoss ? (
                <TrendingDown className="h-5 w-5" />
              ) : (
                <Sparkles className="h-5 w-5" />
              )}
            </div>
            <p className="text-sm font-semibold text-foreground">{label}</p>
          </div>
          {isProfit ? (
            <Badge className="gap-1 bg-income text-income-foreground hover:bg-income">
              <TrendingUp className="h-3.5 w-3.5" />
              กำไร
            </Badge>
          ) : isLoss ? (
            <Badge variant="destructive" className="gap-1">
              <TrendingDown className="h-3.5 w-3.5" />
              ขาดทุน
            </Badge>
          ) : (
            <Badge variant="secondary">ยังไม่มีกำไร</Badge>
          )}
        </div>

        <AnimatedMoney
          satang={profitSatang}
          tone="auto"
          signed
          className="mt-3 block text-5xl font-bold leading-tight tracking-tight sm:text-6xl"
        />

        <p className="mt-3 flex items-center gap-2 text-base font-medium text-foreground/80">
          <span className="text-xl leading-none">{status.emoji}</span>
          <span>{status.text}</span>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatPill label="รายรับ" satang={incomeSatang} tone="income" entriesHref={incomeHref} />
        <StatPill label="รายจ่าย" satang={expenseSatang} tone="expense" entriesHref={expenseHref} />
      </div>
    </div>
  );
}
