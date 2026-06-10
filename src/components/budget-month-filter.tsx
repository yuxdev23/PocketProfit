"use client";

/**
 * BudgetMonthFilter — ตัวกรองเดือนของหน้า "สรุปรายจ่าย & งบประมาณ".
 * แสดงเฉพาะตอนเข้าจากเมนู "เพิ่มเติม" (?filter=1); เข้าจากปุ่ม "งบ" จะซ่อนตัวกรองนี้.
 * ตัวเลือกเป็นเฉพาะ "เดือนที่มีข้อมูล" (server ส่งมาให้). เปลี่ยนเดือน = เขียน
 * ?month=YYYY-MM โดยคง filter=1 ไว้เสมอ (ไม่หลุดโหมดตัวกรอง).
 *
 * ดีไซน์ให้ "เด่น" เป็น primary control ของหน้านี้ (เด่นกว่าการ์ด VAT ด้านล่าง):
 * พื้น brand-soft + เส้นขอบ brand + เงาอุ่น + ไอคอนวงกลมทึบ + select ตัวใหญ่ตัวหนา.
 */

import { useRouter } from "next/navigation";
import { CalendarRange } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type MonthChoice = { value: string; label: string };

export function BudgetMonthFilter({
  value,
  months,
}: {
  value: string;
  months: MonthChoice[];
}) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-3 rounded-2xl border-2 border-brand/40 bg-brand-soft p-3.5 shadow-warm">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-warm-sm">
        <CalendarRange className="h-[22px] w-[22px]" strokeWidth={2.3} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand">
          เลือกเดือน
        </p>
        <Select
          value={value}
          onValueChange={(v) => router.push(`/budgets?filter=1&month=${v}`)}
        >
          <SelectTrigger
            aria-label="เลือกเดือนที่ต้องการดู"
            className="mt-1 h-11 w-full border-brand/30 bg-background text-base font-bold text-foreground"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map((m) => (
              <SelectItem key={m.value} value={m.value} className="text-base">
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
