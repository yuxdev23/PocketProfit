import Link from "next/link";
import { AlertTriangle, TrendingDown, ArrowRight } from "lucide-react";

import { requireUser } from "@/lib/auth";
import {
  profitComparison,
  categorySummaries,
  listProducts,
  dayEntries,
  listCategories,
  getGoal,
  todayDateKey,
  isTodayKey,
  formatThaiDayKey,
} from "@/lib/queries";
import { ensureRecurringForCurrentMonth } from "@/lib/actions/recurring";
import { marginPct, progressPct } from "@/lib/calc";
import { formatBaht } from "@/lib/money";
import { monthKeyToThai } from "@/lib/dates";
import { toEntryView } from "@/lib/serialize";
import { ProfitHero } from "@/components/profit-hero";
import { EntryList } from "@/components/entry-list";
import { EmptyState } from "@/components/states";
import { DateStepper } from "@/components/date-stepper";
import { Card, CardContent } from "@/components/ui/card";
import { ColorBar } from "@/components/ui/color-bar";

export const dynamic = "force-dynamic";

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>;
}) {
  const user = await requireUser();
  const today = todayDateKey();

  // คำทักทายใช้ชื่อของผู้ใช้ที่ล็อกอินจริง (เดิม hardcode "นภา" จาก seed → ขึ้นชื่อนี้ทุกบัญชี)
  const displayName = user.name?.trim() || user.email.split("@")[0];

  // K: หน้าหลักดูย้อนหลังได้ผ่าน ?d=YYYY-MM-DD (เวลาไทย) — กัน param แปลก/อนาคต, ค่าเริ่มต้น = วันนี้
  const sp = await searchParams;
  let dateKey = today;
  if (sp.d && /^\d{4}-\d{2}-\d{2}$/.test(sp.d) && sp.d <= today) {
    dateKey = sp.d;
  }
  const onToday = isTodayKey(dateKey);

  // F6: เมื่อถึงเดือนใหม่ ระบบสร้างรายการค่าใช้จ่ายประจำให้อัตโนมัติ (idempotent ต่อเดือน)
  // — ผูกกับ "เดือนปัจจุบันจริง" เสมอ ไม่ขึ้นกับวันที่ที่กำลังดูย้อนหลัง.
  await ensureRecurringForCurrentMonth(user.id);

  // ยอดของ "วันที่เลือก" + เดือนที่วันนั้นสังกัด (goal/งบจะอิงเดือนของวันที่เลือกโดยอัตโนมัติ)
  const { today: day, prevDay, current, monthKey } = await profitComparison(user.id, dateKey);

  const [cats, products, entries, categories, goal] = await Promise.all([
    categorySummaries(user.id, monthKey),
    listProducts(user.id),
    dayEntries(user.id, dateKey),
    listCategories(user.id),
    getGoal(user.id, monthKey),
  ]);

  const options = categories.map((c) => ({ id: c.id, name: c.name, kind: c.kind as "income" | "expense" }));
  const entryViews = entries.map(toEntryView);

  // หมวดที่เกินงบของเดือนที่กำลังดู (DoD-2 alert บนหน้าหลัก)
  const overBudget = cats.filter(
    (c) => c.budgetSatang != null && c.budgetSatang > 0 && c.actualSatang > c.budgetSatang,
  );
  // สินค้า margin ต่ำกว่าเกณฑ์ (F5 alert) — เป็นคุณสมบัติของสินค้า ไม่ผูกวัน จึงแสดงสถานะปัจจุบันเสมอ
  const lowMargin = products.filter((p) => marginPct(p.costSatang, p.priceSatang) < p.lowMarginThresholdPct);

  const incomePct = goal ? progressPct(current.income, goal.incomeTargetSatang) : 0;

  return (
    <div className="space-y-5">
      <header className="space-y-3">
        <div>
          <p className="text-sm text-muted-foreground">
            {onToday ? formatThaiDayKey(today) : "ดูย้อนหลัง"}
          </p>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            {onToday ? `สวัสดี ${displayName} 👋` : `สรุปวันที่ ${formatThaiDayKey(dateKey)}`}
          </h1>
        </div>
        {/* K: แถบเลื่อนวัน (ย้อนหลัง/ถัดไป) — ปิดอนาคต · ไม่มีการ์ดครอบเพื่อความโล่ง */}
        <DateStepper dateKey={dateKey} />
      </header>

      {/* Hero: กำไรสุทธิของวันที่เลือก (DoD-3 รายวัน) — ตัวเลขใหญ่ count-up + สถานะอบอุ่น + พิลล์รายรับ/รายจ่าย */}
      <ProfitHero
        label={onToday ? "กำไรสุทธิวันนี้" : "กำไรสุทธิของวันนี้"}
        profitSatang={day.net}
        incomeSatang={day.income}
        expenseSatang={day.expense}
        yesterdayProfitSatang={prevDay.net}
        isToday={onToday}
      />

      {/* สิ่งที่ต้องดู: ยุบ alert เกินงบ + margin ต่ำ เป็นการ์ดเดียวแบบ slim (ลดความรก) */}
      {overBudget.length > 0 || lowMargin.length > 0 ? (
        <div className="divide-y divide-border rounded-xl border border-border bg-card p-3.5 shadow-warm-sm">
          {overBudget.length > 0 ? (
            <div className="flex items-start gap-2.5 py-2.5 first:pt-0 last:pb-0">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-expense" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">
                  ใช้เกินงบ {overBudget.length} หมวด{onToday ? "" : ` · ${monthKeyToThai(monthKey)}`}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {overBudget.map((c) => c.name).join(", ")}
                </p>
              </div>
              <Link href="/budgets" className="shrink-0 text-xs font-medium text-brand hover:underline">
                ดู
              </Link>
            </div>
          ) : null}
          {lowMargin.length > 0 ? (
            <div className="flex items-start gap-2.5 py-2.5 first:pt-0 last:pb-0">
              <TrendingDown className="mt-0.5 h-4 w-4 shrink-0 text-expense" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">
                  สินค้ากำไรต่ำ {lowMargin.length} รายการ
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {lowMargin.map((p) => p.name).join(", ")}
                </p>
              </div>
              <Link href="/products" className="shrink-0 text-xs font-medium text-brand hover:underline">
                ดู
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* progress เป้ารายได้ของเดือนที่กำลังดู (DoD-4 สรุปย่อ) */}
      {goal && goal.incomeTargetSatang > 0 ? (
        <Card>
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-foreground">
                เป้ารายได้ {monthKeyToThai(monthKey)}
              </span>
              <Link href="/goals" className="flex items-center gap-0.5 text-xs text-brand">
                ดูเป้า <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <ColorBar value={incomePct} tone="brand" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>฿{formatBaht(current.income)} / ฿{formatBaht(goal.incomeTargetSatang)}</span>
              <span className="font-semibold text-brand">{incomePct}%</span>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* ลิสต์รายการของวันที่เลือก (F1) */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-foreground">
          {onToday ? "รายการวันนี้" : `รายการวันที่ ${formatThaiDayKey(dateKey)}`}
        </h2>
        {entryViews.length === 0 ? (
          <EmptyState
            name="receipt"
            title={onToday ? "วันนี้ยังไม่มีรายการ" : "วันนี้ไม่มีรายการ"}
            description={
              onToday
                ? "แตะปุ่ม + บันทึก เพื่อบันทึกบิลแรกของวัน"
                : "ลองเลื่อนดูวันอื่น หรือกลับมาวันนี้เพื่อบันทึกรายการ"
            }
          />
        ) : (
          <EntryList entries={entryViews} categories={options} todayKey={today} showDate={false} />
        )}
      </section>
    </div>
  );
}
