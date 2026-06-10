import { requireUser } from "@/lib/auth";
import {
  profitComparison,
  dailyNetSeries,
  monthlyNetSeries,
  monthsWithEntries,
} from "@/lib/queries";
import { changePct, direction } from "@/lib/calc";
import {
  monthKeyToThai,
  todayDateKey,
  monthDateRange,
  currentMonthKey,
  formatThaiDate,
  bkkDateKeyToInstant,
} from "@/lib/dates";
import { ProfitView } from "@/components/profit-view";
import type { FilterChoice } from "@/components/profit-date-filter";

// ข้อมูลอิงวันนี้/เดือนนี้ (เวลาไทย) คำนวณสดทุก request → ข้ามวัน/เดือนจริงอัปเดตเอง
export const dynamic = "force-dynamic";

const pad = (n: number) => String(n).padStart(2, "0");
const dayLabelOf = (dateKey: string) =>
  formatThaiDate(bkkDateKeyToInstant(dateKey) ?? new Date());

/**
 * หน้า "กำไรสุทธิ".
 * - เข้าจากปุ่ม "กำไร" (ไม่มี param) → ล็อกวันนี้/เดือนนี้ ไม่แสดงตัวกรอง (ตามเดิม).
 * - เข้าจากเมนู "สรุปกำไรสุทธิของแต่ละเดือน" (?filter=1) → แสดงตัวกรองเลือกวัน/เดือนย้อนหลัง
 *   (เดือนที่มีข้อมูลเท่านั้น) แล้วสรุปกำไรของช่วงที่เลือก.
 */
export default async function ProfitPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; m?: string; d?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const filterMode = sp.filter === "1";
  const curMonth = currentMonthKey();

  let month = curMonth;
  let day = todayDateKey();
  let monthOptions: FilterChoice[] = [];
  let dayOptions: FilterChoice[] = [];

  if (filterMode) {
    const months = await monthsWithEntries(user.id); // ใหม่ → เก่า, รวมเดือนปัจจุบันเสมอ
    month = sp.m && months.includes(sp.m) ? sp.m : curMonth;
    monthOptions = months.map((mk) => ({ value: mk, label: monthKeyToThai(mk) }));

    // ตัวเลือก "วัน": เดือนปัจจุบัน → ถึง "วันนี้" เท่านั้น (ไม่ให้เลือกวันอนาคต); เดือนย้อนหลัง → ทั้งเดือน
    const range = monthDateRange(month);
    const lastDay =
      month === curMonth ? Number(todayDateKey().slice(-2)) : Number(range.to.slice(-2));
    dayOptions = Array.from({ length: lastDay }, (_, i) => {
      const dk = `${month}-${pad(i + 1)}`;
      return { value: dk, label: dayLabelOf(dk) };
    });
  }

  // โหลดกราฟรายวันของเดือนที่ดู (ใช้เลือกวันเริ่มต้นที่ "มีข้อมูลล่าสุด" ของเดือนย้อนหลังด้วย)
  const daily = await dailyNetSeries(user.id, filterMode ? month : undefined);

  if (filterMode) {
    const lastDay = Number(monthDateRange(month).to.slice(-2));
    const inMonth = (dk: string) =>
      /^\d{4}-\d{2}-\d{2}$/.test(dk) &&
      dk.startsWith(`${month}-`) &&
      Number(dk.slice(-2)) >= 1 &&
      Number(dk.slice(-2)) <= lastDay;

    // วันเริ่มต้น: เดือนปัจจุบัน → วันนี้ · เดือนย้อนหลัง → วันที่มีข้อมูลล่าสุดในเดือนนั้น
    const fallbackDay =
      month === curMonth
        ? todayDateKey()
        : `${month}-${pad(daily.length ? Math.max(...daily.map((s) => s.day)) : lastDay)}`;
    day = sp.d && inMonth(sp.d) ? sp.d : fallbackDay;
  }

  const [cmp, monthly] = await Promise.all([
    profitComparison(user.id, filterMode ? day : undefined),
    monthlyNetSeries(user.id, 6, filterMode ? month : undefined),
  ]);

  const dailySeries = daily.map((d) => ({ label: String(d.day), net: d.net }));
  const monthlySeries = monthly.map((m) => ({
    label: monthKeyToThai(m.monthKey).split(" ")[0].slice(0, 3),
    net: m.net,
  }));

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-lg font-bold text-foreground">กำไรสุทธิ</h1>
        <p className="text-sm text-muted-foreground">
          {filterMode
            ? "เลือกดูกำไรสุทธิรายวัน / รายเดือนย้อนหลังได้"
            : "รายรับ − รายจ่าย พร้อมเทียบเดือนก่อน"}
        </p>
      </header>
      <ProfitView
        monthLabel={monthKeyToThai(cmp.monthKey)}
        prevMonthLabel={monthKeyToThai(cmp.prevMonthKey)}
        today={cmp.today}
        current={cmp.current}
        previous={cmp.previous}
        changePct={changePct(cmp.current.net, cmp.previous.net)}
        direction={direction(cmp.current.net, cmp.previous.net)}
        dailySeries={dailySeries}
        monthlySeries={monthlySeries}
        dayKey={cmp.dateKey}
        monthRange={monthDateRange(cmp.monthKey)}
        isToday={cmp.dateKey === todayDateKey()}
        isCurrentMonth={cmp.monthKey === curMonth}
        dayLabel={dayLabelOf(cmp.dateKey)}
        filter={filterMode ? { month, day, monthOptions, dayOptions } : undefined}
      />
    </div>
  );
}
