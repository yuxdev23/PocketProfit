import Link from "next/link";
import { ArrowDown, ArrowUp, Minus, ListChecks } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatMoney, formatSignedMoney } from "@/lib/money";
import type { Direction } from "@/lib/calc";

/**
 * การ์ดตัวเลขสรุป — กำไรสุทธิ / รายรับ / รายจ่าย.
 * - signed=true -> แสดง +/− และสีเขียว(บวก)/แดง(ลบ) + ลูกศร (ไม่พึ่งสีอย่างเดียว = a11y).
 * - กัน NaN เสมอ (formatMoney แปลง NaN -> 0).
 */
export function StatCard({
  label,
  satang,
  variant = "neutral",
  signed = false,
  hint,
  entriesHref,
  className,
}: {
  label: string;
  satang: number;
  variant?: "neutral" | "income" | "expense" | "auto";
  signed?: boolean;
  hint?: string;
  /** ถ้ามี → โชว์ไอคอนลิงก์ไปดูรายการที่กรองไว้แล้ว */
  entriesHref?: string;
  className?: string;
}) {
  const safe = Number.isFinite(satang) ? satang : 0;
  const resolved =
    variant === "auto" ? (safe < 0 ? "expense" : safe > 0 ? "income" : "neutral") : variant;
  const color =
    resolved === "income"
      ? "text-income"
      : resolved === "expense"
        ? "text-expense"
        : "text-foreground";
  const tintBg =
    resolved === "income"
      ? "border-income/15 bg-income-soft"
      : resolved === "expense"
        ? "border-expense/15 bg-expense-soft"
        : "";

  return (
    <Card className={cn("min-w-0", tintBg, className)}>
      <CardContent className="flex flex-col gap-1 p-4">
        <div className="flex items-start justify-between gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
          {entriesHref ? (
            <Link
              href={entriesHref}
              aria-label={`ดูรายการ${label}`}
              title={`ดูรายการ${label}`}
              className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground"
            >
              <ListChecks className="h-4 w-4" strokeWidth={2.25} />
            </Link>
          ) : null}
        </div>
        <span className={cn("flex items-center gap-1 text-2xl font-bold tabular-nums", color)}>
          {signed && safe !== 0 ? (
            safe > 0 ? (
              <ArrowUp className="h-5 w-5 shrink-0" aria-hidden />
            ) : (
              <ArrowDown className="h-5 w-5 shrink-0" aria-hidden />
            )
          ) : null}
          <span className="truncate">{signed ? formatSignedMoney(safe) : formatMoney(safe)}</span>
        </span>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </CardContent>
    </Card>
  );
}

/** ป้ายทิศทางเทียบเดือนก่อน ▲▼% — pct=null -> "—" (กัน Infinity). (DoD-3) */
export function TrendBadge({ dir, pct }: { dir: Direction; pct: number | null }) {
  const Icon = dir === "up" ? ArrowUp : dir === "down" ? ArrowDown : Minus;
  const color =
    dir === "up" ? "text-income" : dir === "down" ? "text-expense" : "text-muted-foreground";
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-sm font-semibold", color)}>
      <Icon className="h-4 w-4" aria-hidden />
      {pct === null ? "—" : `${Math.abs(pct)}%`}
    </span>
  );
}
