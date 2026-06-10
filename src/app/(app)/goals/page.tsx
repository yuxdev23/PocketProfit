import { requireUser } from "@/lib/auth";
import { getGoal, monthTotals } from "@/lib/queries";
import { currentMonthKey, monthKeyToThai } from "@/lib/dates";
import { progressPct } from "@/lib/calc";
import { EmptyState } from "@/components/states";
import { SetGoalDialog } from "@/components/set-goal-dialog";
import { GoalCard } from "@/components/goal-card";

// เดือน + ข้อมูลทั้งหมดอิง currentMonthKey() (เวลาไทย) คำนวณสดทุก request → เปลี่ยนเดือนจริงแล้วอัปเดตเอง
export const dynamic = "force-dynamic";

export default async function GoalsPage() {
  const user = await requireUser();
  const month = currentMonthKey();
  const [goal, totals] = await Promise.all([getGoal(user.id, month), monthTotals(user.id, month)]);

  const incomeTarget = goal?.incomeTargetSatang ?? 0;
  const expenseTarget = goal?.expenseTargetSatang ?? 0;
  const incomePct = progressPct(totals.income, incomeTarget);
  const expensePct = progressPct(totals.expense, expenseTarget);

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold text-foreground">เป้าเดือนนี้</h1>
          <p className="text-sm text-muted-foreground">{monthKeyToThai(month)}</p>
        </div>
        <SetGoalDialog
          month={month}
          incomeTargetBaht={incomeTarget ? String(incomeTarget / 100) : ""}
          expenseTargetBaht={expenseTarget ? String(expenseTarget / 100) : ""}
          triggerLabel={goal ? "แก้เป้า" : "ตั้งเป้า"}
        />
      </header>

      {!goal ? (
        <EmptyState
          name="inbox"
          title="ยังไม่ได้ตั้งเป้าเดือนนี้"
          description="ตั้งเป้ารายได้และเพดานรายจ่ายเพื่อดูความคืบหน้าเป็น %"
        />
      ) : (
        <>
          {/* เป้ารายได้ — วงแหวน + แถบ + สถานะ */}
          <GoalCard
            kind="income"
            month={month}
            pct={incomePct}
            actualSatang={totals.income}
            targetSatang={incomeTarget}
          />

          {/* เพดานรายจ่าย — วงแหวน + แถบ + สถานะ */}
          <GoalCard
            kind="expense"
            month={month}
            pct={expensePct}
            actualSatang={totals.expense}
            targetSatang={expenseTarget}
          />
        </>
      )}
    </div>
  );
}
