import "server-only";

/**
 * Registry ของ "เครื่องมืออ่านข้อมูล" (read-only tools) — นี่คือ scope lock ของผู้ช่วย (AI-7).
 *
 * กฎความปลอดภัย:
 *  - ทุก tool เป็น READ-ONLY ล้วน ๆ ไม่มีตัวไหน create/update/delete (ตรวจได้ด้วย grep ใน verify).
 *  - ทุก run() รับ userId แล้วเรียก query/calc เดิมที่ผูก userId เสมอ → ไม่มี cross-user leak.
 *  - run() คืน object เล็ก ๆ ที่ "แปลงเป็นบาทแล้ว" + label ไทยสั้น ๆ — ไม่ส่งสตางค์ ไม่ส่ง Prisma row ดิบ
 *    (โมเดล/UI จึงไม่ต้องคำนวณเงินเอง และ token น้อย).
 *
 * ใช้ร่วมกันทั้งโหมด A (claude.ts expose เป็น tool-use) และโหมด B (deterministic.ts เรียกตรง).
 */

import { z } from "zod";

import { satangToBaht } from "@/lib/money";
import { changePct, direction, marginPct, usagePct, progressPct } from "@/lib/calc";
import {
  profitComparison,
  categorySummaries,
  getGoal,
  monthTotals,
  listProducts,
  listRecurring,
  monthlyVatSummary,
  monthlyNetSeries,
} from "@/lib/queries";
import { monthKeyToThai } from "@/lib/dates";

/** บาท (number) ปัดให้สวย 2 ตำแหน่ง — กัน floating error เช่น 0.8999999. */
function baht(satang: number): number {
  return Math.round(satangToBaht(satang) * 100) / 100;
}

/** schema ที่ tool ส่วนใหญ่ใช้: ไม่มี args หรือมี monthKey (YYYY-MM) แบบ optional. */
const noArgs = z.object({}).strict();
const optMonth = z
  .object({ monthKey: z.string().regex(/^\d{4}-\d{2}$/).optional() })
  .strict();

/** รูปแบบ tool หนึ่งตัว. run() เป็น read-only เสมอ. */
export type AssistantTool = {
  name: string;
  /** คำอธิบายภาษาไทยให้โมเดลเลือกใช้ (โหมด A). */
  description: string;
  inputSchema: z.ZodTypeAny;
  /** อ่านข้อมูลของ userId แล้วคืน JSON เล็ก ๆ (หน่วยบาท). args ผ่าน inputSchema มาแล้ว. */
  run: (userId: string, args: Record<string, unknown>) => Promise<unknown>;
};

// ── payload types ที่ run() คืน (หน่วยบาท) — ใช้ใน deterministic renderer แบบ type-safe ──
export type ProfitPayload = {
  profitToday: number;
  profitMonth: number;
  incomeMonth: number;
  expenseMonth: number;
  prevMonth: number;
  changePct: number | null;
  direction: "up" | "down" | "flat";
  monthLabel: string;
  prevMonthLabel: string;
  /** เดือนนี้มีรายการแล้วหรือยัง (รายรับหรือรายจ่าย > 0) — ใช้ตัดสิน NO_DATA สำหรับผู้ใช้ใหม่ (AI-5). */
  monthHasData: boolean;
};
export type BudgetItem = {
  category: string;
  used: number;
  budget: number;
  remaining: number;
  pct: number;
  over: boolean;
  nearOver: boolean;
};
export type BudgetPayload = { anyBudgetSet: boolean; overCount: number; items: BudgetItem[] };
export type GoalPayload =
  | { goalSet: false }
  | {
      goalSet: true;
      incomeTarget: number;
      incomeActual: number;
      incomePct: number;
      expenseCap: number;
      expenseActual: number;
      expensePct: number;
      expenseOverCap: boolean;
    };
export type ProductItem = {
  name: string;
  cost: number;
  price: number;
  marginPct: number;
  threshold: number;
  low: boolean;
};
export type MarginPayload = { hasProducts: boolean; lowCount: number; items: ProductItem[] };
export type RecurringItem = {
  name: string;
  type: string;
  amount: number;
  dayOfMonth: number;
  postedThisMonth: boolean;
  skippedThisMonth: boolean;
};
export type RecurringPayload = { hasRecurring: boolean; items: RecurringItem[] };
export type VatPayload = {
  hasVat: boolean;
  outputVat: number;
  inputVat: number;
  netVat: number;
  vatEntryCount: number;
};
export type TrendMonth = { month: string; income: number; expense: number; net: number };
export type TrendPayload = { months: TrendMonth[] };

/** ตัวช่วยอ่าน monthKey จาก args (ถ้า parse ผ่าน). */
function monthArg(args: Record<string, unknown>): string | undefined {
  const v = args?.monthKey;
  return typeof v === "string" && /^\d{4}-\d{2}$/.test(v) ? v : undefined;
}

export const assistantTools: AssistantTool[] = [
  {
    name: "getProfitSummary",
    description:
      "กำไรสุทธิ (รายรับ−รายจ่าย) ของวันนี้และของเดือนนี้ พร้อมเทียบกับเดือนก่อนเป็นเปอร์เซ็นต์และทิศทาง ใช้ตอบ 'กำไรวันนี้/เดือนนี้เท่าไหร่' หรือ 'เทียบเดือนก่อนเป็นยังไง'",
    // ไม่รับ monthKey: run() ผูกกับ "วันนี้/เดือนนี้ vs เดือนก่อน" เสมอ (profitComparison อิงปัจจุบัน).
    // เลิกโฆษณา monthKey กันโมเดล (โหมด A) ขอเดือนย้อนหลังแล้วได้เลขเดือนปัจจุบันติดป้ายผิดเดือน.
    inputSchema: noArgs,
    async run(userId): Promise<ProfitPayload> {
      // ใช้ profitComparison (อิงวันนี้) → ได้ทั้งวันนี้ เดือนนี้ และเดือนก่อนในครั้งเดียว
      const c = await profitComparison(userId);
      const cur = c.current.net;
      const prev = c.previous.net;
      return {
        profitToday: baht(c.today.net),
        profitMonth: baht(cur),
        incomeMonth: baht(c.current.income),
        expenseMonth: baht(c.current.expense),
        prevMonth: baht(prev),
        changePct: changePct(cur, prev), // null = เทียบไม่ได้ (เดือนก่อน 0)
        direction: direction(cur, prev), // "up" | "down" | "flat"
        monthLabel: monthKeyToThai(c.monthKey),
        prevMonthLabel: monthKeyToThai(c.prevMonthKey),
        monthHasData: c.current.income > 0 || c.current.expense > 0,
      };
    },
  },

  {
    name: "getBudgetStatus",
    description:
      "สถานะงบประมาณรายหมวดของเดือน: ใช้ไปเท่าไหร่ จากงบเท่าไหร่ เหลือเท่าไหร่ คิดเป็นกี่ % และหมวดไหนใช้เกินงบหรือใกล้เกิน ใช้ตอบ 'หมวดไหนใช้เกินงบ' หรือ 'งบเหลือเท่าไหร่'",
    inputSchema: optMonth,
    async run(userId, args): Promise<BudgetPayload> {
      const rows = await categorySummaries(userId, monthArg(args));
      // เฉพาะหมวดที่ "ตั้งงบไว้" เท่านั้นถึงจะเทียบงบได้
      const withBudget = rows.filter((r) => r.budgetSatang != null && r.budgetSatang > 0);
      const items = withBudget.map((r) => {
        const budget = r.budgetSatang as number;
        const pct = usagePct(r.actualSatang, budget);
        return {
          category: r.name,
          used: baht(r.actualSatang),
          budget: baht(budget),
          remaining: baht(budget - r.actualSatang),
          pct, // ไม่ clamp เพดาน → เห็นว่าเกินกี่ %
          over: r.actualSatang > budget,
          nearOver: r.actualSatang <= budget && pct >= 80, // ใกล้เต็มงบ (≥80%)
        };
      });
      return {
        anyBudgetSet: withBudget.length > 0,
        overCount: items.filter((i) => i.over).length,
        items: items.sort((a, b) => b.pct - a.pct), // หมวดที่ใช้หนักสุดขึ้นก่อน
      };
    },
  },

  {
    name: "getGoalProgress",
    description:
      "ความคืบหน้าเป้าหมายของเดือน: เป้ารายได้กับยอดรายรับจริง (กี่ %) และเพดานรายจ่ายกับยอดรายจ่ายจริง (กี่ %) ใช้ตอบ 'เข้าเป้ารายได้ยัง' หรือ 'ใช้จ่ายเกินเพดานไหม'",
    inputSchema: optMonth,
    async run(userId, args): Promise<GoalPayload> {
      const mk = monthArg(args);
      const [goal, totals] = await Promise.all([getGoal(userId, mk), monthTotals(userId, mk)]);
      if (!goal) {
        return { goalSet: false };
      }
      return {
        goalSet: true,
        incomeTarget: baht(goal.incomeTargetSatang),
        incomeActual: baht(totals.income),
        incomePct: progressPct(totals.income, goal.incomeTargetSatang), // % จริง (เกิน 100 ได้)
        expenseCap: baht(goal.expenseTargetSatang),
        expenseActual: baht(totals.expense),
        expensePct: progressPct(totals.expense, goal.expenseTargetSatang),
        expenseOverCap: totals.expense > goal.expenseTargetSatang,
      };
    },
  },

  {
    name: "getLowMarginProducts",
    description:
      "อัตรากำไรขั้นต้น (margin %) ของสินค้าแต่ละตัว และตัวไหนกำไรต่ำกว่าเกณฑ์ที่ตั้งไว้ ใช้ตอบ 'สินค้าไหนกำไรน้อย' หรือ 'มาร์จิ้นสินค้าเท่าไหร่'",
    inputSchema: noArgs,
    async run(userId): Promise<MarginPayload> {
      const products = await listProducts(userId);
      const items = products.map((p) => {
        const m = marginPct(p.costSatang, p.priceSatang); // guard หารศูนย์ในตัวแล้ว
        return {
          name: p.name,
          cost: baht(p.costSatang),
          price: baht(p.priceSatang),
          marginPct: m,
          threshold: p.lowMarginThresholdPct,
          low: m < p.lowMarginThresholdPct,
        };
      });
      return {
        hasProducts: items.length > 0,
        lowCount: items.filter((i) => i.low).length,
        items: items.sort((a, b) => a.marginPct - b.marginPct), // กำไรน้อยสุดขึ้นก่อน
      };
    },
  },

  {
    name: "getRecurringStatus",
    description:
      "ค่าใช้จ่าย/รายรับประจำเดือน (เช่น ค่าเช่า) และเดือนนี้ลงรายการให้แล้วหรือยัง/ถูกข้ามหรือไม่ ใช้ตอบ 'ค่าเช่าเดือนนี้ลงยัง' หรือ 'มีรายการประจำอะไรบ้าง'",
    inputSchema: optMonth,
    async run(userId, args): Promise<RecurringPayload> {
      const rules = await listRecurring(userId, monthArg(args));
      return {
        hasRecurring: rules.length > 0,
        items: rules.map((r) => ({
          name: r.name,
          type: r.type === "income" ? "รายรับ" : "รายจ่าย",
          amount: baht(r.amountSatang),
          dayOfMonth: r.dayOfMonth,
          postedThisMonth: r.generatedThisMonth,
          skippedThisMonth: r.skippedThisMonth,
        })),
      };
    },
  },

  {
    name: "getVatSummary",
    description:
      "สรุปภาษีมูลค่าเพิ่ม (VAT) ของเดือน: ภาษีขาย (จากรายรับ) ภาษีซื้อ (จากรายจ่าย) และภาษีสุทธิที่ต้องนำส่งโดยประมาณ ใช้ตอบ 'ภาษีเดือนนี้เท่าไหร่' หรือ 'VAT ต้องจ่ายเท่าไหร่'",
    inputSchema: optMonth,
    async run(userId, args): Promise<VatPayload> {
      const v = await monthlyVatSummary(userId, monthArg(args));
      return {
        hasVat: v.vatEntryCount > 0,
        outputVat: baht(v.outputVatSatang), // ภาษีขาย
        inputVat: baht(v.inputVatSatang), // ภาษีซื้อ
        netVat: baht(v.netVatSatang), // ภาษีสุทธิ (ขาย−ซื้อ)
        vatEntryCount: v.vatEntryCount,
      };
    },
  },

  {
    name: "getSpendingTrend",
    description:
      "แนวโน้มกำไรสุทธิย้อนหลัง 6 เดือน (รายรับ รายจ่าย กำไรสุทธิ ต่อเดือน) ใช้ตอบ 'แนวโน้มกำไรเป็นยังไง' หรือ 'ย้อนหลังหลายเดือนเป็นไง'",
    inputSchema: noArgs,
    async run(userId): Promise<TrendPayload> {
      const series = await monthlyNetSeries(userId, 6);
      return {
        months: series.map((s) => ({
          month: monthKeyToThai(s.monthKey),
          income: baht(s.income),
          expense: baht(s.expense),
          net: baht(s.net),
        })),
      };
    },
  },
];

/** หา tool ตามชื่อ (ใช้ใน claude.ts ตอน execute tool_use). */
export function findTool(name: string): AssistantTool | undefined {
  return assistantTools.find((t) => t.name === name);
}
