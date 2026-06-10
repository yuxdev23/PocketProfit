"use client";

/**
 * BudgetsView — มุมมองหน้า "สรุปรายจ่าย & งบประมาณ" (client):
 *  - เฉพาะ "รายจ่าย" เท่านั้น (งบเป็นเรื่องของรายจ่าย — รายรับไปดูที่หน้ากำไร/เป้า)
 *  - ช่องค้นหาหมวด (A4)
 *  - แต่ละการ์ดมีไอคอนไป /entries กรองหมวด+เดือนนี้ (A2) + hover เบา ๆ (A3)
 */

import { useState } from "react";
import { Search } from "lucide-react";

import type { BudgetRow } from "@/lib/queries";
import { formatMoney } from "@/lib/money";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { BudgetRows, UnbudgetedRows, type MonthRange } from "@/components/budget-rows";

export function BudgetsView({
  rows,
  monthRange,
  isCurrentMonth = true,
  editable = true,
}: {
  rows: BudgetRow[];
  monthRange: MonthRange;
  /** true = กำลังดูเดือนปัจจุบัน → ใช้คำว่า "เดือนนี้"; false = ดูย้อนหลัง → "เดือนที่เลือก" */
  isCurrentMonth?: boolean;
  /** true = แก้งบได้ (หน้า "งบ" เดือนปัจจุบัน); false = อ่านอย่างเดียว (เข้าจากเมนูดูย้อนหลัง) — ซ่อนปุ่มแก้งบ */
  editable?: boolean;
}) {
  const [q, setQ] = useState("");

  const nq = q.trim().toLowerCase();
  const match = (r: BudgetRow) => !nq || r.name.toLowerCase().includes(nq);

  // เฉพาะหมวดรายจ่าย
  const expenseAll = rows.filter((r) => r.kind === "expense");

  if (expenseAll.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border py-12 text-center">
        <p className="text-sm font-medium text-foreground">ยังไม่มีหมวดรายจ่าย</p>
        <p className="mt-1 text-xs text-muted-foreground">
          เพิ่มหมวดได้ที่หน้า “จัดการหมวด” แล้วตั้งงบเพื่อรับการเตือนเมื่อใช้เกิน
        </p>
      </div>
    );
  }

  // ยอดรวม (สรุป) ใช้ค่าทั้งเดือน ไม่ขึ้นกับ search; รายการการ์ดถึงกรองด้วย search
  const totalExpense = expenseAll.reduce((s, r) => s + r.actualSatang, 0);
  const totalBudget = expenseAll
    .filter((r) => r.budgetSatang != null)
    .reduce((s, r) => s + (r.budgetSatang ?? 0), 0);

  const expense = expenseAll.filter(match);
  const withBudget = expense.filter((r) => r.budgetSatang != null);
  const withoutBudget = expense.filter((r) => r.budgetSatang == null);

  return (
    <div className="space-y-4">
      {/* ค้นหาหมวด */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ค้นหาหมวด…"
          aria-label="ค้นหาหมวด"
          className="h-10 pl-9"
        />
      </div>

      {/* การ์ดสรุปยอด */}
      <Card>
        <CardContent className="flex items-center justify-between p-4">
          <div>
            <p className="text-xs text-muted-foreground">
              {isCurrentMonth ? "ใช้จ่ายรวมเดือนนี้" : "ใช้จ่ายรวมเดือนที่เลือก"}
            </p>
            <p className="text-xl font-bold tabular-nums text-foreground">{formatMoney(totalExpense)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">งบรวมที่ตั้งไว้</p>
            <p className="text-xl font-bold tabular-nums text-muted-foreground">
              {totalBudget > 0 ? formatMoney(totalBudget) : "—"}
            </p>
          </div>
        </CardContent>
      </Card>

      {withBudget.length > 0 ? (
        <BudgetRows rows={withBudget} groupTotalSatang={totalExpense} monthRange={monthRange} editable={editable} />
      ) : null}

      {withoutBudget.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">ยังไม่ได้ตั้งงบ</h2>
          <UnbudgetedRows
            rows={withoutBudget}
            groupTotalSatang={totalExpense}
            monthRange={monthRange}
            isCurrentMonth={isCurrentMonth}
            editable={editable}
          />
        </section>
      ) : null}

      {expense.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
          {nq ? `ไม่พบหมวดรายจ่ายที่ตรงกับ “${q}”` : "ยังไม่มีหมวดรายจ่าย"}
        </p>
      ) : null}
    </div>
  );
}
