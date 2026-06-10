import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  PartyPopper,
  CheckCircle2,
  ListChecks,
  type LucideIcon,
} from "lucide-react";

import { formatBaht, formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { ProgressRing } from "@/components/progress-ring";
import { AnimatedMoney } from "@/components/animated-money";
import { monthDateRange } from "@/lib/dates";

/**
 * GoalCard — การ์ดเป้ารายเดือน (ใช้ได้ทั้ง "เป้ารายได้" และ "เพดานรายจ่าย").
 *
 * ต่อยอดจากของเดิม (ProgressRing + ยอด "ทำได้/ใช้ไป" + "เป้า/เพดาน") โดย "เพิ่ม":
 *  - แถบความคืบหน้าเชิงเส้นใต้วงแหวน (ย้ำ % ให้อ่านง่ายขึ้น)
 *  - บรรทัดสถานะภาษาไทย "เสมอ" (เหลืออีก…ถึงเป้า / เกินเพดานแล้ว…)
 *  - พิลล์สถานะเล็ก ๆ (ตามเป้า / ใกล้ถึง / เกิน) สีตาม token
 *  - ข้อความให้กำลังใจ 1 บรรทัด
 * ยอดเงินเป็น "สตางค์" ทั้งหมด แสดงผ่าน AnimatedMoney/formatMoney (คงตรรกะเงินเดิม).
 *
 * income: ทำได้มาก = ดี (เขียว). expense: ใช้น้อยกว่าเพดาน = ดี, เกิน = เตือน (แดง).
 */
export function GoalCard({
  kind,
  pct,
  actualSatang,
  targetSatang,
  month,
}: {
  kind: "income" | "expense";
  /** % ความคืบหน้า (เกิน 100 ได้เมื่อทำเกินเป้า/เพดาน) */
  pct: number;
  /** income: รายรับสะสม / expense: รายจ่ายสะสม */
  actualSatang: number;
  /** income: เป้ารายได้ / expense: เพดานรายจ่าย */
  targetSatang: number;
  /** เดือน "YYYY-MM" — ทำลิงก์ไป /entries กรองประเภท+เดือนนี้ */
  month: string;
}) {
  const isIncome = kind === "income";

  // ลิงก์ไป "รายการทั้งหมด" กรองประเภท (รายรับ/รายจ่าย) + เดือนนี้ให้พร้อม
  const range = monthDateRange(month);
  const entriesHref = `/entries?type=${kind}&from=${range.from}&to=${range.to}`;

  // สถานะหลัก: income → ถึงเป้าหรือยัง, expense → เกินเพดานหรือยัง
  const reached = isIncome && targetSatang > 0 && actualSatang >= targetSatang;
  const over = !isIncome && targetSatang > 0 && actualSatang > targetSatang;
  // "ใกล้" = เกิน 80% แต่ยังไม่ถึง/ไม่เกิน → เตือนแบบอ่อน (amber)
  const near = !reached && !over && pct >= 80;

  // ส่วนต่างจากเป้า (สตางค์, ไม่ติดลบ) — ใช้ในบรรทัดสถานะ
  const diff = Math.abs(targetSatang - actualSatang);

  // โทนของวงแหวน/แถบ: ดี = income/brand, เตือน = expense, ใกล้ = brand
  const ringTone: "income" | "expense" | "brand" = reached
    ? "income"
    : over
      ? "expense"
      : "brand";
  const barColor = reached
    ? "bg-income"
    : over
      ? "bg-expense"
      : "bg-brand";

  const HeaderIcon: LucideIcon = isIncome ? TrendingUp : TrendingDown;
  const headerIconClass = isIncome
    ? "bg-income-soft text-income"
    : "bg-expense-soft text-expense";

  const title = isIncome ? "เป้ารายได้" : "เพดานรายจ่าย";
  const subtitle = isIncome ? "รายรับสะสม ÷ เป้า" : "รายจ่ายสะสม ÷ เพดาน";
  const actualLabel = isIncome ? "ทำได้" : "ใช้ไป";
  const targetLabel = isIncome ? "เป้า" : "เพดาน";
  const centerSub = isIncome
    ? reached
      ? "ถึงเป้าแล้ว"
      : "ของเป้า"
    : over
      ? "เกินเพดาน"
      : "ของเพดาน";

  // พิลล์สถานะ + ข้อความให้กำลังใจ (เลือกตามสถานะ)
  const status = pickStatus({ isIncome, reached, over, near });

  // บรรทัดสถานะ "เสมอ" (always-on)
  const statusLine = isIncome ? (
    reached ? (
      <>
        เกินเป้าแล้ว{" "}
        <span className="font-semibold text-income">฿{formatBaht(diff)}</span> 🎉
      </>
    ) : (
      <>
        เหลืออีก{" "}
        <span className="font-semibold text-foreground">฿{formatBaht(diff)}</span>{" "}
        ถึงเป้า
      </>
    )
  ) : over ? (
    <>
      เกินเพดานแล้ว{" "}
      <span className="font-semibold text-expense">฿{formatBaht(diff)}</span>
    </>
  ) : (
    <>
      ใช้ได้อีก{" "}
      <span className="font-semibold text-foreground">฿{formatBaht(diff)}</span>{" "}
      ก่อนถึงเพดาน
    </>
  );

  return (
    <Card
      className={cn(
        isIncome ? "border-income/25" : "border-border/70",
        reached && "border-income/40",
        over && "border-expense/50",
      )}
    >
      <CardContent className="space-y-4 p-5">
        {/* หัวการ์ด */}
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full",
              headerIconClass,
            )}
          >
            <HeaderIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground">{title}</p>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <StatusPill {...status} />
        </div>

        {/* วงแหวน + ยอด */}
        <div className="flex items-center gap-5">
          <ProgressRing pct={pct} tone={ringTone} centerSub={centerSub} />
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">{actualLabel}</p>
              <div className="flex items-center gap-2.5">
                <AnimatedMoney
                  satang={actualSatang}
                  tone={isIncome ? "income" : over ? "expense" : "neutral"}
                  className="text-xl font-bold"
                />
                <Link
                  href={entriesHref}
                  aria-label={`ดูรายการ${isIncome ? "รายรับ" : "รายจ่าย"}เดือนนี้ทั้งหมด`}
                  title={`ดู${isIncome ? "รายรับ" : "รายจ่าย"}เดือนนี้`}
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all hover:scale-110 active:scale-95",
                    isIncome
                      ? "bg-income/10 text-income hover:bg-income/20"
                      : "bg-expense/10 text-expense hover:bg-expense/20",
                  )}
                >
                  <ListChecks className="h-[18px] w-[18px]" strokeWidth={2.25} />
                </Link>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{targetLabel}</p>
              <p className="text-base font-semibold tabular-nums text-foreground">
                {formatMoney(targetSatang)}
              </p>
            </div>
          </div>
        </div>

        {/* แถบความคืบหน้าเชิงเส้น — ย้ำ % ใต้วงแหวน */}
        <div
          className="h-2.5 w-full overflow-hidden rounded-full bg-foreground/10"
          role="progressbar"
          aria-valuenow={Math.min(100, Math.round(pct))}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none",
              barColor,
            )}
            style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
          />
        </div>

        {/* บรรทัดสถานะ (always-on) */}
        <p className="text-center text-sm text-muted-foreground">{statusLine}</p>

        {/* ข้อความให้กำลังใจ 1 บรรทัด */}
        <p
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium",
            status.softClass,
          )}
        >
          <status.Icon className="h-4 w-4 shrink-0" />
          {status.helper}
        </p>
      </CardContent>
    </Card>
  );
}

/** ป้ายสถานะเล็ก ๆ มุมขวาบนของหัวการ์ด */
function StatusPill({
  pillLabel,
  pillClass,
  Icon,
}: ReturnType<typeof pickStatus>) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
        pillClass,
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {pillLabel}
    </span>
  );
}

/**
 * เลือก "สถานะ" ของการ์ด → ป้าย, สี token, ไอคอน, และคำให้กำลังใจ.
 * แยกเป็นฟังก์ชันเพื่ออ่านง่ายและคุมข้อความไทยไว้ที่เดียว.
 */
function pickStatus({
  isIncome,
  reached,
  over,
  near,
}: {
  isIncome: boolean;
  reached: boolean;
  over: boolean;
  near: boolean;
}): {
  pillLabel: string;
  pillClass: string;
  softClass: string;
  helper: string;
  Icon: LucideIcon;
} {
  // เกินเพดาน (เฉพาะรายจ่าย) → เตือนแดง
  if (over) {
    return {
      pillLabel: "เกินงบ",
      pillClass: "bg-expense/12 text-expense",
      softClass: "bg-expense-soft text-expense",
      helper: "ลองชะลอรายจ่ายที่ไม่จำเป็นสักหน่อยนะ เดี๋ยวก็กลับมาคุมได้",
      Icon: AlertTriangle,
    };
  }

  // ถึงเป้ารายได้แล้ว → ฉลองเขียว
  if (reached) {
    return {
      pillLabel: "ถึงเป้าแล้ว",
      pillClass: "bg-income/12 text-income",
      softClass: "bg-income-soft text-income",
      helper: "เยี่ยมมาก ทำได้ตามเป้าแล้ว ที่เหลือคือกำไรล้วน ๆ 🎉",
      Icon: PartyPopper,
    };
  }

  // ใกล้ถึง (>80%) → เตือนอ่อน amber
  if (near) {
    return {
      pillLabel: "ใกล้ถึง",
      pillClass: "bg-brand/15 text-brand",
      softClass: "bg-brand/10 text-brand",
      helper: isIncome
        ? "อีกนิดเดียวก็ถึงเป้าแล้ว สู้ ๆ ใกล้แล้วจริง ๆ"
        : "ใกล้ถึงเพดานแล้ว ระวังรายจ่ายช่วงท้ายเดือนหน่อยนะ",
      Icon: AlertTriangle,
    };
  }

  // ปกติ / ยังไปได้สวย → เขียวเบา ๆ
  return {
    pillLabel: "ตามเป้า",
    pillClass: "bg-income/12 text-income",
    softClass: "bg-income-soft text-income",
    helper: isIncome
      ? "กำลังไปได้สวย ค่อย ๆ เก็บไปเรื่อย ๆ เดี๋ยวก็ถึงเป้า"
      : "ยังอยู่ในงบสบาย ๆ คุมแบบนี้ต่อไปได้เลย",
    Icon: CheckCircle2,
  };
}
