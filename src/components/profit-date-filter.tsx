"use client";

/**
 * ProfitDateFilter — ตัวกรอง "วัน / เดือน" ของหน้ากำไรสุทธิ.
 * แสดงเฉพาะตอนเข้าจากเมนู "สรุปกำไรสุทธิของแต่ละเดือน" (?filter=1);
 * เข้าจากปุ่ม "กำไร" ปกติจะไม่แสดง.
 * - เลือกเดือน → เขียน ?filter=1&m=YYYY-MM (รีเซ็ตวันให้เป็นค่าเริ่มของเดือนนั้น)
 * - เลือกวัน  → เขียน ?filter=1&m=YYYY-MM&d=YYYY-MM-DD (คงเดือนเดิม)
 * คง filter=1 ไว้เสมอเพื่อไม่หลุดโหมดตัวกรอง.
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

export type FilterChoice = { value: string; label: string };

export function ProfitDateFilter({
  month,
  day,
  monthOptions,
  dayOptions,
}: {
  month: string;
  day: string;
  monthOptions: FilterChoice[];
  dayOptions: FilterChoice[];
}) {
  const router = useRouter();

  return (
    <div className="space-y-2.5 rounded-2xl border-2 border-brand/40 bg-brand-soft p-3.5 shadow-warm">
      <div className="flex items-center gap-2 text-brand">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-warm-sm">
          <CalendarRange className="h-[18px] w-[18px]" strokeWidth={2.3} />
        </span>
        <p className="text-xs font-semibold uppercase tracking-wide">เลือกช่วงที่ต้องการดู</p>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">เดือน</label>
          <Select
            value={month}
            onValueChange={(v) => router.push(`/profit?filter=1&m=${v}`)}
          >
            <SelectTrigger
              aria-label="เลือกเดือนที่ต้องการดู"
              className="h-10 w-full border-brand/30 bg-background font-semibold text-foreground"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">วัน</label>
          <Select
            value={day}
            onValueChange={(v) => router.push(`/profit?filter=1&m=${month}&d=${v}`)}
          >
            <SelectTrigger
              aria-label="เลือกวันที่ต้องการดู"
              className="h-10 w-full border-brand/30 bg-background font-semibold text-foreground"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {dayOptions.map((d) => (
                <SelectItem key={d.value} value={d.value}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
