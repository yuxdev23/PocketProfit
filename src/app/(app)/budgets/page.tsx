import Link from "next/link";
import { Receipt } from "lucide-react";

import { requireUser } from "@/lib/auth";
import { categorySummaries, monthlyVatSummary, monthsWithEntries } from "@/lib/queries";
import { currentMonthKey, monthKeyToThai, monthDateRange } from "@/lib/dates";
import { formatBaht } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { BudgetsView } from "@/components/budgets-view";
import { BudgetMonthFilter, type MonthChoice } from "@/components/budget-month-filter";

// เดือน + ข้อมูลอิง currentMonthKey() (เวลาไทย) คำนวณสดทุก request → ข้ามเดือนจริงแล้วอัปเดตเอง
export const dynamic = "force-dynamic";

export default async function BudgetsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; month?: string }>;
}) {
  const user = await requireUser();

  // เปิดตัวกรองเดือนเฉพาะเมื่อเข้าจากเมนู "เพิ่มเติม" (?filter=1) → เลือกดูเดือนย้อนหลังที่มีข้อมูลได้.
  // เข้าจากปุ่ม "งบ" (ไม่มี param) → ล็อกเดือนปัจจุบัน + ซ่อนตัวกรอง (ตามสเปก).
  const sp = await searchParams;
  const filterMode = sp.filter === "1";
  const requested = typeof sp.month === "string" ? sp.month : undefined;

  let month = currentMonthKey();
  let monthOptions: MonthChoice[] = [];
  if (filterMode) {
    // includes() ทำหน้าที่ทั้ง validate รูปแบบและจำกัดให้เลือกได้เฉพาะเดือนที่มีข้อมูลจริง;
    // ค่าแปลก/เดือนว่าง → fallback เดือนปัจจุบัน (อยู่ใน list เสมอ ทำให้ dropdown โชว์ค่าได้).
    const months = await monthsWithEntries(user.id);
    if (requested && months.includes(requested)) month = requested;
    monthOptions = months.map((mk) => ({ value: mk, label: monthKeyToThai(mk) }));
  }
  const isCurrentMonth = month === currentMonthKey();

  const [rows, vat] = await Promise.all([
    categorySummaries(user.id, month),
    monthlyVatSummary(user.id, month),
  ]);
  const monthRange = monthDateRange(month);

  return (
    <div className="space-y-5">
      <header className="space-y-3">
        <div>
          <h1 className="text-lg font-bold text-foreground">สรุปรายจ่าย & งบประมาณ</h1>
          <p className="text-sm text-muted-foreground">
            {filterMode
              ? "เลือกดูยอดใช้จ่ายและงบของเดือนที่มีข้อมูลย้อนหลังได้"
              : monthKeyToThai(month)}
          </p>
        </div>
        {/* ตัวกรองเดือน — แสดงเฉพาะเมื่อเข้าจากเมนู "เพิ่มเติม" */}
        {filterMode ? <BudgetMonthFilter value={month} months={monthOptions} /> : null}
      </header>

      {/* N3: สรุปภาษี (VAT) ของเดือนที่เลือก — การ์ดสรุปสั้น (รอง: ใช้ขอบกลาง ๆ ให้ตัวกรองเดือนเด่นกว่า) */}
      {vat.vatEntryCount > 0 ? (
        <Card className="border-border">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-brand" />
                <h2 className="text-sm font-semibold text-foreground">
                  ภาษีมูลค่าเพิ่ม (VAT) {isCurrentMonth ? "เดือนนี้" : monthKeyToThai(month)}
                </h2>
              </div>
              <Link
                href="/vat"
                className="shrink-0 text-xs font-medium text-brand hover:underline"
              >
                ดูภาษีเต็ม →
              </Link>
            </div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                ภาษีสุทธิที่ต้องนำส่งโดยประมาณ · จาก {vat.vatEntryCount} รายการ
              </p>
              <p
                className={cn(
                  "shrink-0 text-lg font-bold tabular-nums",
                  vat.netVatSatang > 0 ? "text-expense" : vat.netVatSatang < 0 ? "text-income" : "text-foreground",
                )}
              >
                {vat.netVatSatang < 0 ? "−" : ""}฿{formatBaht(Math.abs(vat.netVatSatang))}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* แก้งบได้เฉพาะหน้า "งบ" (เดือนปัจจุบัน); เข้าจากเมนูดูย้อนหลัง (?filter=1) = อ่านอย่างเดียว */}
      <BudgetsView
        rows={rows}
        monthRange={monthRange}
        isCurrentMonth={isCurrentMonth}
        editable={!filterMode}
      />
    </div>
  );
}
