"use client";

/** หน้ากำไร (DoD-3, F3) — Tabs รายวัน/รายเดือน + ตัวเลขใหญ่ count-up + ▲▼% เทียบเดือนก่อน + กราฟ. */

import { Sparkles, TrendingUp, TrendingDown, BarChart3, Scale } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard, TrendBadge } from "@/components/stat-card";
import { StatPill } from "@/components/stat-pill";
import { ProfitHero } from "@/components/profit-hero";
import { AnimatedMoney } from "@/components/animated-money";
import { ProfitChart, CompareChart, type ChartPoint } from "@/components/profit-chart";
import { ProfitDateFilter, type FilterChoice } from "@/components/profit-date-filter";
import { formatMoney } from "@/lib/money";
import { type Direction } from "@/lib/calc";
import { cn } from "@/lib/utils";

export type ProfitViewProps = {
  monthLabel: string;
  prevMonthLabel: string;
  today: { income: number; expense: number; net: number };
  current: { income: number; expense: number; net: number };
  previous: { income: number; expense: number; net: number };
  changePct: number | null;
  direction: Direction;
  dailySeries: ChartPoint[];
  monthlySeries: ChartPoint[];
  /** วันที่ของ "วันนี้" (YYYY-MM-DD) สำหรับลิงก์ดูรายการรายวัน */
  dayKey: string;
  /** ขอบเขตวันที่ของเดือนนี้ สำหรับลิงก์ดูรายการรายเดือน */
  monthRange: { from: string; to: string };
  /** ตัวกรองวัน/เดือน — แสดงเฉพาะเข้าจากเมนู "สรุปกำไรสุทธิของแต่ละเดือน" (?filter=1) */
  filter?: {
    month: string;
    day: string;
    monthOptions: FilterChoice[];
    dayOptions: FilterChoice[];
  };
  /** วันที่ที่ดูคือ "วันนี้" ไหม (คุมป้ายหัวข้อรายวัน) — ดีฟอลต์ถือเป็นวันนี้ */
  isToday?: boolean;
  /** เดือนที่ดูคือ "เดือนนี้" ไหม (คุมป้ายหัวข้อรายเดือน) — ดีฟอลต์ถือเป็นเดือนนี้ */
  isCurrentMonth?: boolean;
  /** ป้ายวันที่แบบไทยของวันที่ดู เช่น "10 มิ.ย. 69" (ใช้กับหัวข้อรายวันเมื่อไม่ใช่วันนี้) */
  dayLabel?: string;
};

export function ProfitView(props: ProfitViewProps) {
  const monthIsProfit = props.current.net > 0;
  const monthIsLoss = props.current.net < 0;

  // มีข้อมูลเดือนก่อนไหม (มีการเคลื่อนไหวอย่างใดอย่างหนึ่ง) — กันแสดงแท่ง/ประโยคเทียบกับศูนย์ลอย ๆ
  const hasPrevious =
    props.previous.income !== 0 || props.previous.expense !== 0 || props.previous.net !== 0;

  // ประโยคสรุปกำไรเทียบเดือนก่อน + ส่วนต่าง (สตางค์) แบบมีเครื่องหมาย
  const netDiff = props.current.net - props.previous.net;
  const diffMagnitude = formatMoney(Math.abs(netDiff)); // formatMoney กัน NaN -> ฿0
  const diffSentence = !hasPrevious
    ? "ยังไม่มีข้อมูลเดือนก่อนไว้เทียบ เริ่มบันทึกเดือนนี้ไว้ดูแนวโน้มได้เลย"
    : netDiff > 0
      ? `เดือนนี้กำไรมากกว่าเดือนก่อน ${diffMagnitude} เก่งมาก ทำต่อไปนะ`
      : netDiff < 0
        ? `เดือนนี้กำไรน้อยกว่าเดือนก่อน ${diffMagnitude} ไม่เป็นไร ค่อย ๆ ปรับได้`
        : "เดือนนี้กำไรเท่ากับเดือนก่อนพอดี ทรงตัวดี";

  // สัดส่วนรายรับ vs รายจ่ายของเดือนนี้ (อิงยอดรวม income+expense) — กันหารศูนย์
  const flow = props.current.income + props.current.expense;
  const incomeShare = flow > 0 ? Math.round((props.current.income / flow) * 100) : 0;
  const expenseShare = flow > 0 ? 100 - incomeShare : 0;

  // ป้ายหัวข้อ — สะท้อนวัน/เดือนที่เลือกในโหมดตัวกรอง (ไม่งั้นคงเดิม "วันนี้/เดือนนี้")
  const dayHeroLabel =
    props.isToday === false ? `กำไรสุทธิวันที่ ${props.dayLabel ?? ""}`.trim() : "กำไรสุทธิวันนี้";
  const monthHeroLabel =
    props.isCurrentMonth === false
      ? `กำไรสุทธิ (${props.monthLabel})`
      : `กำไรสุทธิเดือนนี้ (${props.monthLabel})`;

  return (
    <div className="space-y-4">
      {props.filter ? (
        <ProfitDateFilter
          month={props.filter.month}
          day={props.filter.day}
          monthOptions={props.filter.monthOptions}
          dayOptions={props.filter.dayOptions}
        />
      ) : null}
      <Tabs defaultValue="daily" className="space-y-4">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="daily">รายวัน</TabsTrigger>
        <TabsTrigger value="monthly">รายเดือน</TabsTrigger>
      </TabsList>

      {/* รายวัน */}
      <TabsContent value="daily" className="space-y-4">
        <ProfitHero
          label={dayHeroLabel}
          profitSatang={props.today.net}
          incomeSatang={props.today.income}
          expenseSatang={props.today.expense}
          incomeHref={`/entries?type=income&from=${props.dayKey}&to=${props.dayKey}`}
          expenseHref={`/entries?type=expense&from=${props.dayKey}&to=${props.dayKey}`}
        />
        <Card>
          <CardContent className="space-y-2 p-4">
            <p className="text-sm font-semibold text-foreground">กำไรสุทธิรายวัน — {props.monthLabel}</p>
            <ProfitChart data={props.dailySeries} />
          </CardContent>
        </Card>
      </TabsContent>

      {/* รายเดือน */}
      <TabsContent value="monthly" className="space-y-4">
        <div
          className={cn(
            "rounded-3xl border bg-card p-6 shadow-warm animate-fade-slide-up",
            monthIsProfit ? "border-income/25" : monthIsLoss ? "border-expense/30" : "border-border",
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full",
                  monthIsProfit
                    ? "bg-income-soft text-income"
                    : monthIsLoss
                      ? "bg-expense-soft text-expense"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {monthIsProfit ? (
                  <TrendingUp className="h-5 w-5" />
                ) : monthIsLoss ? (
                  <TrendingDown className="h-5 w-5" />
                ) : (
                  <Sparkles className="h-5 w-5" />
                )}
              </div>
              <p className="text-sm font-semibold text-foreground">
                {monthHeroLabel}
              </p>
            </div>
            {monthIsProfit ? (
              <Badge className="gap-1 bg-income text-income-foreground hover:bg-income">
                <TrendingUp className="h-3.5 w-3.5" />
                กำไร
              </Badge>
            ) : monthIsLoss ? (
              <Badge variant="destructive" className="gap-1">
                <TrendingDown className="h-3.5 w-3.5" />
                ขาดทุน
              </Badge>
            ) : (
              <Badge variant="secondary">ยังไม่มีกำไร</Badge>
            )}
          </div>
          <AnimatedMoney
            satang={props.current.net}
            tone="auto"
            signed
            className="mt-3 block text-5xl font-bold leading-tight tracking-tight sm:text-6xl"
          />
          <div className="relative mt-3 flex items-center gap-1.5 text-sm text-foreground/80">
            <span>เทียบ {props.prevMonthLabel}:</span>
            <TrendBadge dir={props.direction} pct={props.changePct} />
            {props.changePct === null ? (
              <span className="text-xs">(ไม่มีข้อมูลเดือนก่อน)</span>
            ) : (
              <span className="text-xs">
                ({props.direction === "up" ? "มากขึ้น" : props.direction === "down" ? "น้อยลง" : "เท่าเดิม"})
              </span>
            )}
          </div>
          <p className="relative mt-1 text-xs text-muted-foreground">
            เดือนก่อน: {formatMoney(props.previous.net)}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="รายรับเดือนนี้"
            satang={props.current.income}
            variant="income"
            entriesHref={`/entries?type=income&from=${props.monthRange.from}&to=${props.monthRange.to}`}
          />
          <StatCard
            label="รายจ่ายเดือนนี้"
            satang={props.current.expense}
            variant="expense"
            entriesHref={`/entries?type=expense&from=${props.monthRange.from}&to=${props.monthRange.to}`}
          />
        </div>

        {/* เทียบเดือนก่อน vs เดือนนี้ — รายรับ / รายจ่าย / กำไร (F3) */}
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <BarChart3 className="h-4 w-4 text-brand" />
                เทียบเดือนก่อน vs เดือนนี้
              </p>
              <span className="text-xs text-muted-foreground">
                {props.prevMonthLabel} → {props.monthLabel}
              </span>
            </div>
            <CompareChart
              current={props.current}
              previous={props.previous}
              hasPrevious={hasPrevious}
            />
            {/* ประโยคสรุปกำไรแบบเป็นกันเอง */}
            <p className="flex items-start gap-1.5 rounded-2xl bg-brand/10 px-3 py-2.5 text-sm text-foreground">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
              <span>{diffSentence}</span>
            </p>
          </CardContent>
        </Card>

        {/* สัดส่วนรายรับ vs รายจ่ายของเดือนนี้ */}
        <Card>
          <CardContent className="space-y-3 p-4">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <Scale className="h-4 w-4 text-brand" />
              สัดส่วนเงินเข้า-ออกเดือนนี้
            </p>
            {flow > 0 ? (
              <>
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-income transition-all"
                    style={{ width: `${incomeShare}%` }}
                    aria-hidden
                  />
                  <div
                    className="h-full bg-expense transition-all"
                    style={{ width: `${expenseShare}%` }}
                    aria-hidden
                  />
                </div>
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-income">รายรับ {incomeShare}%</span>
                  <span className="text-expense">รายจ่าย {expenseShare}%</span>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">ยังไม่มีรายการในเดือนนี้</p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <StatPill label="รายรับ" satang={props.current.income} tone="income" />
              <StatPill label="รายจ่าย" satang={props.current.expense} tone="expense" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 p-4">
            <p className="text-sm font-semibold text-foreground">กำไรสุทธิรายเดือน (6 เดือนล่าสุด)</p>
            <ProfitChart data={props.monthlySeries} />
          </CardContent>
        </Card>
      </TabsContent>
      </Tabs>
    </div>
  );
}
