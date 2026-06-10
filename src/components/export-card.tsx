"use client";

import * as React from "react";
import { Download, FileSpreadsheet } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MonthOption } from "@/lib/dates";

/**
 * การ์ด "ดาวน์โหลดทั้งเดือน" — เลือกเดือนจาก dropdown แล้วกดดาวน์โหลด CSV.
 * ดาวน์โหลด = navigation ปกติไปยัง GET /entries/export (route เดียวกับตัวกรองในหน้า
 * รายการ — มีคอลัมน์ VAT/ก่อน VAT + กัน formula injection อยู่แล้ว) โดยแปลง monthKey
 * "YYYY-MM" เป็นช่วง ?from=…-01&to=…-<วันสุดท้าย>. ไม่ต้องโหลดทั้งไฟล์เข้า memory ฝั่ง client.
 */
export function ExportCard({ months }: { months: MonthOption[] }) {
  const [month, setMonth] = React.useState(months[0]?.value ?? "");

  // "YYYY-MM" -> { from: "YYYY-MM-01", to: "YYYY-MM-<วันสุดท้ายของเดือน>" }
  const [from, to] = React.useMemo(() => monthBounds(month), [month]);
  const href = `/entries/export?from=${from}&to=${to}`;

  return (
    <Card className="rounded-2xl p-5">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-income-soft text-income">
          <FileSpreadsheet className="h-6 w-6" strokeWidth={2.2} />
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-foreground">ดาวน์โหลดทั้งเดือน</p>
          <p className="text-sm text-muted-foreground">
            เลือกเดือน แล้วได้ทุกรายการของเดือนนั้นเป็นไฟล์ CSV
          </p>
        </div>
      </div>

      <Label className="mb-1.5 block text-sm font-medium text-foreground">
        เลือกเดือน
      </Label>
      <Select value={month} onValueChange={setMonth}>
        <SelectTrigger className="h-12 w-full text-base">
          <SelectValue placeholder="เลือกเดือน" />
        </SelectTrigger>
        <SelectContent>
          {months.map((m) => (
            <SelectItem key={m.value} value={m.value} className="py-2.5 text-base">
              {m.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        asChild
        disabled={!month}
        className="mt-4 h-14 w-full bg-brand text-lg text-brand-foreground hover:bg-brand/90"
      >
        {/* download = navigation ไป route โดยตรง (route ส่ง Content-Disposition: attachment) */}
        <a href={href} download>
          <Download className="h-5 w-5" strokeWidth={2.4} />
          ดาวน์โหลด CSV
        </a>
      </Button>
    </Card>
  );
}

/** "YYYY-MM" -> [วันที่ 1, วันที่สุดท้ายของเดือน] เป็น "YYYY-MM-DD" (ไม่พึ่ง timezone เครื่อง) */
function monthBounds(monthKey: string): [string, string] {
  const [y, mo] = monthKey.split("-").map(Number);
  if (!y || !mo) return ["", ""];
  // วันที่ 0 ของเดือนถัดไป = วันสุดท้ายของเดือนนี้ (รองรับ 28/29/30/31)
  const lastDay = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return [`${y}-${pad(mo)}-01`, `${y}-${pad(mo)}-${pad(lastDay)}`];
}
