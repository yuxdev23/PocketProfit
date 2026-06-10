import { Repeat, Check, MinusCircle, PauseCircle } from "lucide-react";

import { requireUser } from "@/lib/auth";
import { listRecurring, listCategories } from "@/lib/queries";
import { currentMonthKey, monthKeyToThai, recentMonths } from "@/lib/dates";
import {
  generateRecurringForMonth,
  countRecurringToGenerate,
} from "@/lib/actions/recurring";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/states";
import {
  AddRecurringDialog,
  RecurringMonthSelect,
  GenerateRecurringButton,
} from "@/components/recurring-dialog";
import { RecurringRowActions } from "@/components/recurring-row-actions";

export default async function RecurringPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const user = await requireUser();
  const months = recentMonths(12);
  const current = currentMonthKey();
  const sp = await searchParams;

  // เลือกเดือนจาก ?m= (ต้องอยู่ในช่วงที่เลือกได้) ไม่งั้น default = เดือนปัจจุบัน
  const month =
    sp.m && months.some((m) => m.value === sp.m) ? sp.m : current;
  const isCurrentMonth = month === current;
  const monthLabel = monthKeyToThai(month);

  // F6: ลงรายการประจำของ "เดือนที่กำลังดู" ให้อัตโนมัติ (idempotent) ก่อนอ่านสถานะ
  await generateRecurringForMonth(user.id, month);

  const [rules, categories, pendingCount] = await Promise.all([
    listRecurring(user.id, month),
    listCategories(user.id),
    countRecurringToGenerate(user.id, month),
  ]);
  const options = categories.map((c) => ({ id: c.id, name: c.name, kind: c.kind as "income" | "expense" }));

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-foreground">ค่าใช้จ่ายประจำ</h1>
          <p className="text-sm text-muted-foreground">รายการที่เกิดซ้ำทุกเดือน · {monthLabel}</p>
        </div>
        <AddRecurringDialog categories={options} />
      </header>

      {/* เลือกเดือนที่อยากดู/พรีวิว + ปุ่มสร้างรายการประจำของเดือนนั้น (idempotent) */}
      <div className="space-y-2.5 rounded-xl border border-border bg-card p-3">
        <RecurringMonthSelect value={month} months={months} />
        {rules.length > 0 ? (
          <GenerateRecurringButton
            monthKey={month}
            monthLabel={monthLabel}
            pendingCount={pendingCount}
          />
        ) : null}
        <p className="px-0.5 text-center text-xs text-muted-foreground">
          เปิดหน้านี้ระบบจะลงรายการประจำของเดือนที่เลือกให้อัตโนมัติ ·
          “ข้ามเดือนนี้” ไม่ลบรูปแบบ เดือนถัดไปยังเกิดปกติ
        </p>
      </div>

      {rules.length === 0 ? (
        <EmptyState
          name="inbox"
          title="ยังไม่มีค่าใช้จ่ายประจำ"
          description="ตั้งค่าเช่า/ค่าน้ำค่าไฟให้ขึ้นอัตโนมัติทุกเดือน — กดปุ่ม เพิ่มรายการประจำ"
        />
      ) : (
        <div className="space-y-2.5">
          {rules.map((r) => {
            const isIncome = r.type === "income";
            const paused = !r.active;
            return (
              <Card key={r.id} className={cn(paused && "opacity-70")}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                        isIncome ? "bg-income-soft text-income" : "bg-expense-soft text-expense",
                      )}
                    >
                      <Repeat className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-foreground">{r.name}</p>
                      <p className="text-xs text-muted-foreground">
                        ทุกวันที่ {r.dayOfMonth} ของเดือน · {r.categoryName}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={cn("font-bold tabular-nums", isIncome ? "text-income" : "text-expense")}>
                        {isIncome ? "+" : "−"}
                        {formatMoney(r.amountSatang)}
                      </p>
                      {paused ? (
                        <Badge variant="outline" className="mt-1">
                          <PauseCircle className="mr-1 h-3 w-3" /> หยุดอยู่
                        </Badge>
                      ) : r.skippedThisMonth ? (
                        <Badge className="mt-1 bg-accent text-accent-foreground hover:bg-accent">
                          <MinusCircle className="mr-1 h-3 w-3" /> ข้ามเดือนนี้
                        </Badge>
                      ) : r.generatedThisMonth ? (
                        <Badge variant="secondary" className="mt-1">
                          <Check className="mr-1 h-3 w-3" /> ลงรายการแล้ว
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="mt-1">
                          รอลงรายการ
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="border-t border-border pt-2">
                    <RecurringRowActions
                      id={r.id}
                      name={r.name}
                      active={r.active}
                      skippedThisMonth={r.skippedThisMonth}
                      monthLabel={monthLabel}
                      isCurrentMonth={isCurrentMonth}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
