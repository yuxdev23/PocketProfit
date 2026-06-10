import Link from "next/link";
import { ArrowUpRight, ArrowDownRight, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";

/**
 * StatPill — พิลล์ยอดย่อย (รายรับ/รายจ่าย) พื้นเขียว/แดงนุ่ม + ไอคอนขึ้น/ลง.
 * ใช้คู่กับ Hero กำไรวันนี้. tone กำหนดสี + ทิศไอคอน.
 * ตัวเลขแสดงเต็มเสมอ ("฿6,695") ไม่ truncate บนหน้าจอแคบ. tabular-nums.
 */
export function StatPill({
  label,
  satang,
  tone,
  entriesHref,
  className,
}: {
  label: string;
  satang: number;
  tone: "income" | "expense";
  /** ถ้ามี → โชว์ไอคอนลิงก์ไปดูรายการที่กรองไว้แล้ว */
  entriesHref?: string;
  className?: string;
}) {
  const isIncome = tone === "income";
  const Icon = isIncome ? ArrowUpRight : ArrowDownRight;
  const color = isIncome ? "text-income" : "text-expense";
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-2xl border p-3.5",
        isIncome
          ? "border-income/15 bg-income-soft"
          : "border-expense/15 bg-expense-soft",
        className,
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
          isIncome ? "bg-income/15 text-income" : "bg-expense/15 text-expense",
        )}
      >
        <Icon className="h-5 w-5" strokeWidth={2.4} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <span
          className={cn(
            "block whitespace-nowrap text-xl font-bold leading-tight tabular-nums",
            color,
          )}
        >
          {formatMoney(satang)}
        </span>
      </div>
      {entriesHref ? (
        <Link
          href={entriesHref}
          aria-label={`ดูรายการ${label}`}
          title={`ดูรายการ${label}`}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground"
        >
          <ListChecks className="h-[18px] w-[18px]" strokeWidth={2.25} />
        </Link>
      ) : null}
    </div>
  );
}
