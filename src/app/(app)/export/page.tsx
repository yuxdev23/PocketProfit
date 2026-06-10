import type { Metadata } from "next";
import { Check, FileSpreadsheet } from "lucide-react";

import { requireUser } from "@/lib/auth";
import { recentMonths, currentMonthKey, todayDateKey } from "@/lib/dates";
import { Card } from "@/components/ui/card";
import { ExportCard } from "@/components/export-card";
import { ExportRangeCard } from "@/components/export-range-card";

export const metadata: Metadata = {
  title: "ส่งออกข้อมูล",
};

// ข้อมูลในไฟล์อิงรายการล่าสุดเสมอ → เรนเดอร์สดทุกครั้ง
export const dynamic = "force-dynamic";

/**
 * หน้า "ส่งออกข้อมูล" — รวมการดาวน์โหลด CSV ไว้เป็นหน้าเฉพาะ (เดิมซ่อนอยู่ในแถบ
 * ตัวกรองหน้ารายการ). มี 2 การ์ด: ทั้งเดือน (เลือกจาก dropdown) และช่วงวันที่กำหนดเอง.
 * ทั้งคู่ดาวน์โหลดผ่าน GET /entries/export route เดิม (มีคอลัมน์ VAT + แถวสรุป + กัน
 * formula injection + UTF-8 BOM). requireUser() กันคนนอก.
 */
export default async function ExportPage() {
  await requireUser();
  const months = recentMonths(12);
  const monthStart = `${currentMonthKey()}-01`;
  const today = todayDateKey();

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-lg font-bold text-foreground">ส่งออกข้อมูล</h1>
        <p className="text-sm text-muted-foreground">
          ดาวน์โหลดรายรับ-รายจ่ายเป็นไฟล์ CSV ส่งต่อให้นักบัญชีได้เลย
        </p>
      </header>

      <ExportCard months={months} />
      <ExportRangeCard defaultFrom={monthStart} defaultTo={today} />

      {/* บอกผู้ใช้ว่าในไฟล์มีอะไร — ลดความกังวลก่อนกดดาวน์โหลด */}
      <Card className="rounded-2xl border-border/70 bg-card p-5">
        <div className="mb-3 flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
            <FileSpreadsheet className="h-5 w-5" strokeWidth={2.2} />
          </span>
          <p className="font-semibold text-foreground">ในไฟล์มีอะไรบ้าง</p>
        </div>
        <ul className="space-y-2.5">
          {CSV_NOTES.map((note) => (
            <li key={note} className="flex items-start gap-2.5">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-income" strokeWidth={2.6} />
              <span className="text-sm text-muted-foreground">{note}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 border-t border-border/60 pt-3 text-xs text-muted-foreground">
          เปิดได้ทั้ง Excel และ Google Sheets — มี UTF-8 BOM ให้ภาษาไทยไม่เพี้ยน
          และทุกช่องเป็นข้อความ ปลอดภัยจากสูตรแฝง
        </p>
      </Card>
    </div>
  );
}

/** จุดเด่นของไฟล์ CSV ที่ได้ — แสดงเป็นเช็กลิสต์ใต้การ์ดดาวน์โหลด */
const CSV_NOTES = [
  "ทุกรายการในช่วงที่เลือก พร้อมวันที่ ประเภท และหมวด",
  "แยกคอลัมน์ VAT % / ยอด VAT / ยอดก่อน VAT ให้ครบ",
  "ปิดท้ายด้วยแถวสรุป รวมรายรับ รวมรายจ่าย และกำไรสุทธิ",
  "ระบุว่ารายการไหนแนบใบเสร็จไว้แล้ว",
] as const;
