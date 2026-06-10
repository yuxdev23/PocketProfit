import "server-only";

/**
 * โหมด B (deterministic) — ตาข่ายนิรภัยที่ "ทำงานเสมอ" ไม่ต้องใช้ network/key (AI-6 fallback).
 *
 * วิธีทำงาน:
 *  1) normalize คำถามไทย (ตัดช่องว่าง/วรรณยุกต์ที่ไม่จำเป็น, lowercase อังกฤษ)
 *  2) จับ intent จาก keyword → เลือก "data tool" (กำไร/งบ/เป้า/สินค้า/ประจำ/ภาษี/แนวโน้ม)
 *     หรือ "how-to (FAQ)" (ยังไง/วิธี/ตั้ง.../แนบ.../ส่งออก)
 *  3) รัน tool (read-only, ผูก userId) แล้ว render คำตอบไทยแบบ template ที่ฝังตัวเลขจริง + ลิงก์ลึก
 *  4) ถ้าขอบเขตที่จับได้ "ยังไม่มีข้อมูล" → NO_DATA (กัน NaN, ชวนเริ่มบันทึก)
 *  5) ถ้าไม่เข้าเกณฑ์อะไรเลย → OUT_OF_SCOPE (ปฏิเสธสุภาพ ไม่หลอน)
 *
 * ทุกคำตอบมาจาก tool result เท่านั้น — ไม่มีการเดาตัวเลข.
 */

import {
  assistantTools,
  type ProfitPayload,
  type BudgetPayload,
  type GoalPayload,
  type MarginPayload,
  type RecurringPayload,
  type VatPayload,
  type TrendPayload,
} from "@/lib/assistant/tools";
import { matchFaq } from "@/lib/assistant/faq";
import { NO_DATA, OUT_OF_SCOPE } from "@/lib/assistant/scope";
import { formatBaht } from "@/lib/money";

export type AssistantAnswer = { answer: string; sources?: string[] };

/** ฿ + จำนวนบาท (number) → ข้อความ เช่น 8100 → "฿8,100". รับ "บาท number" (ไม่ใช่สตางค์). */
function money(baht: number): string {
  const satang = Math.round((Number.isFinite(baht) ? baht : 0) * 100);
  return `฿${formatBaht(satang)}`;
}

/** กำไรแบบมีเครื่องหมาย: บวก "+฿300", ลบ "−฿300", ศูนย์ "฿0". รับหน่วยบาท. */
function signedMoney(baht: number): string {
  const v = Number.isFinite(baht) ? baht : 0;
  if (v > 0) return `+${money(v)}`;
  if (v < 0) return `−${money(Math.abs(v))}`;
  return money(0);
}

/**
 * normalize คำถาม: trim, ยุบช่องว่าง, lowercase (อังกฤษ), ตัดเครื่องหมายวรรคตอนท้าย.
 * ไทยไม่มี case แต่ทำ lowercase เผื่อ keyword อังกฤษ (vat, csv, margin).
 */
function normalize(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, " ");
}

/** หา tool ตามชื่อ (จาก registry) — กัน typo. */
function tool(name: string) {
  const t = assistantTools.find((x) => x.name === name);
  if (!t) throw new Error(`unknown tool ${name}`);
  return t;
}

/** คำที่บ่งว่าเป็นคำถาม "วิธีใช้" (how-to) → ไป FAQ. */
const HOWTO_HINTS = ["ยังไง", "อย่างไร", "วิธี", "ทำไง", "ทำยังไง", "ขั้นตอน", "ที่ไหน", "เริ่มต้น", "ใช้งาน", "สอน"];

/** ตารางจับ intent ของ "ข้อมูล" → ชื่อ tool. ตรวจตามลำดับ (เจาะจงก่อนกว้าง). */
const DATA_INTENTS: { tool: string; keywords: string[] }[] = [
  { tool: "getVatSummary", keywords: ["ภาษี", "vat", "แวต", "ภาษีขาย", "ภาษีซื้อ"] },
  { tool: "getSpendingTrend", keywords: ["แนวโน้ม", "ย้อนหลัง", "หลายเดือน", "trend", "6 เดือน", "ที่ผ่านมา"] },
  { tool: "getGoalProgress", keywords: ["เป้า", "เป้าหมาย", "เพดาน", "เข้าเป้า", "ถึงเป้า"] },
  { tool: "getBudgetStatus", keywords: ["งบ", "เกินงบ", "งบประมาณ", "เหลือเท่าไหร่", "ใช้เกิน", "ใกล้เต็ม"] },
  { tool: "getLowMarginProducts", keywords: ["สินค้า", "กำไรขั้นต้น", "มาร์จิ้น", "margin", "กำไรน้อย", "กำไรต่ำ", "ต้นทุน", "ราคาขาย"] },
  { tool: "getRecurringStatus", keywords: ["ประจำ", "ค่าเช่า", "รายการประจำ", "ทุกเดือน", "ค่าใช้จ่ายประจำ"] },
  { tool: "getProfitSummary", keywords: ["กำไร", "ขาดทุน", "รายรับ", "รายจ่าย", "สุทธิ", "ได้เท่าไหร่", "เหลือกำไร"] },
];

// ── renderers: tool result → ข้อความไทย (template) ─────────────────────────

function renderProfit(d: ProfitPayload): AssistantAnswer | null {
  // ผู้ใช้ใหม่/เดือนนี้ยังไม่มีรายการ → ให้ตกไป NO_DATA (ชวนเริ่มบันทึก) แทนการโชว์ ฿0 เฉย ๆ (AI-5)
  if (!d.monthHasData) return null;
  const lines = [
    `กำไรเดือนนี้ (${d.monthLabel}) อยู่ที่ ${signedMoney(d.profitMonth)} ครับ`,
    `(รายรับ ${money(d.incomeMonth)} − รายจ่าย ${money(d.expenseMonth)})`,
  ];
  if (d.changePct == null) {
    lines.push(`เทียบกับ ${d.prevMonthLabel} ยังเทียบเป็น % ไม่ได้ครับ (เดือนก่อนยังไม่มียอด)`);
  } else {
    const arrow = d.direction === "up" ? "▲ มากขึ้น" : d.direction === "down" ? "▼ น้อยลง" : "— เท่าเดิม";
    lines.push(`เทียบ ${d.prevMonthLabel} (${signedMoney(d.prevMonth)}) ${arrow} ${Math.abs(d.changePct)}%`);
  }
  lines.push(`ส่วนกำไรวันนี้อยู่ที่ ${signedMoney(d.profitToday)} ครับ`);
  return { answer: lines.join("\n"), sources: ["/profit"] };
}

function renderBudget(d: BudgetPayload): AssistantAnswer | null {
  if (!d.anyBudgetSet) {
    return {
      answer: "ยังไม่ได้ตั้งงบให้หมวดไหนเลยครับ ลองไปที่หน้างบประมาณแล้วกำหนดงบต่อหมวดก่อนนะครับ แล้วผมจะช่วยเช็กให้ว่าหมวดไหนใช้เกิน",
      sources: ["/budgets"],
    };
  }
  const over = d.items.filter((i) => i.over);
  const near = d.items.filter((i) => !i.over && i.nearOver);
  const lines: string[] = [];
  if (over.length > 0) {
    lines.push("หมวดที่ใช้เกินงบเดือนนี้ครับ:");
    for (const i of over) {
      lines.push(`• ${i.category}: ใช้ ${money(i.used)} / งบ ${money(i.budget)} (${i.pct}% เกินมา ${money(Math.abs(i.remaining))})`);
    }
  } else {
    lines.push("ยังไม่มีหมวดไหนใช้เกินงบเลยครับ 👍");
  }
  if (near.length > 0) {
    lines.push("ใกล้เต็มงบ (ระวังไว้นิดนึง):");
    for (const i of near) {
      lines.push(`• ${i.category}: ใช้ ${money(i.used)} / งบ ${money(i.budget)} (${i.pct}%)`);
    }
  }
  return { answer: lines.join("\n"), sources: ["/budgets"] };
}

function renderGoal(d: GoalPayload): AssistantAnswer | null {
  if (!d.goalSet) {
    return {
      answer: "เดือนนี้ยังไม่ได้ตั้งเป้าไว้ครับ ลองไปที่หน้าเป้าหมายแล้วตั้งเป้ารายได้กับเพดานรายจ่ายก่อนนะครับ ผมจะได้บอกความคืบหน้าให้",
      sources: ["/goals"],
    };
  }
  const lines = [
    `ความคืบหน้าเป้าเดือนนี้ครับ:`,
    `• รายได้: ${money(d.incomeActual)} จากเป้า ${money(d.incomeTarget)} = ${d.incomePct}%`,
    `• รายจ่าย: ${money(d.expenseActual)} จากเพดาน ${money(d.expenseCap)} = ${d.expensePct}%${d.expenseOverCap ? " (เกินเพดานแล้ว ระวังนะครับ)" : ""}`,
  ];
  return { answer: lines.join("\n"), sources: ["/goals"] };
}

function renderMargin(d: MarginPayload): AssistantAnswer | null {
  if (!d.hasProducts) {
    return {
      answer: "ยังไม่มีสินค้าในระบบเลยครับ ลองไปที่หน้าสินค้าแล้วเพิ่มสินค้าพร้อมต้นทุน/ราคาขายก่อนนะครับ ผมจะคำนวณกำไรขั้นต้นให้",
      sources: ["/products"],
    };
  }
  const low = d.items.filter((i) => i.low);
  const lines: string[] = [];
  if (low.length > 0) {
    lines.push("สินค้าที่กำไรขั้นต้นต่ำกว่าเกณฑ์ครับ:");
    for (const i of low) {
      lines.push(`• ${i.name}: margin ${i.marginPct}% (ทุน ${money(i.cost)} / ขาย ${money(i.price)}) ต่ำกว่าเกณฑ์ ${i.threshold}%`);
    }
    lines.push("ลองปรับราคาขายหรือลดต้นทุนดูนะครับ");
  } else {
    lines.push("สินค้าทุกตัวกำไรขั้นต้นอยู่ในเกณฑ์ดีครับ 👍");
    const lowest = d.items[0];
    if (lowest) lines.push(`ตัวที่กำไรน้อยสุดคือ ${lowest.name} margin ${lowest.marginPct}%`);
  }
  return { answer: lines.join("\n"), sources: ["/products"] };
}

function renderRecurring(d: RecurringPayload): AssistantAnswer | null {
  if (!d.hasRecurring) {
    return {
      answer: "ยังไม่มีรายการประจำเลยครับ ลองไปที่หน้าค่าใช้จ่ายประจำแล้วเพิ่ม เช่น ค่าเช่า เพื่อให้ระบบลงให้อัตโนมัติทุกเดือนนะครับ",
      sources: ["/recurring"],
    };
  }
  const lines = ["รายการประจำเดือนนี้ครับ:"];
  for (const i of d.items) {
    const status = i.skippedThisMonth ? "ข้ามเดือนนี้" : i.postedThisMonth ? "ลงรายการแล้ว ✓" : "ยังไม่ได้ลง";
    lines.push(`• ${i.name} (${i.type}) ${money(i.amount)} — ${status}`);
  }
  return { answer: lines.join("\n"), sources: ["/recurring"] };
}

function renderVat(d: VatPayload): AssistantAnswer | null {
  if (!d.hasVat) {
    return {
      answer: "เดือนนี้ยังไม่มีรายการที่คิด VAT เลยครับ ตอนบันทึกรายการเปิดสวิตช์ VAT 7% ได้ แล้วผมจะสรุปภาษีให้นะครับ",
      sources: ["/vat"],
    };
  }
  const lines = [
    "สรุปภาษีมูลค่าเพิ่ม (VAT) เดือนนี้ครับ:",
    `• ภาษีขาย: ${money(d.outputVat)}`,
    `• ภาษีซื้อ: ${money(d.inputVat)}`,
    `• ภาษีสุทธิที่ต้องนำส่ง (โดยประมาณ): ${money(d.netVat)}`,
    `จากรายการที่คิด VAT ทั้งหมด ${d.vatEntryCount} รายการ`,
  ];
  return { answer: lines.join("\n"), sources: ["/vat"] };
}

function renderTrend(d: TrendPayload): AssistantAnswer | null {
  if (!d.months || d.months.length === 0) {
    return null; // → NO_DATA
  }
  const hasAny = d.months.some((m) => m.income !== 0 || m.expense !== 0);
  if (!hasAny) return null; // ทุกเดือนว่าง → NO_DATA
  const lines = ["แนวโน้มกำไรสุทธิย้อนหลังครับ:"];
  for (const m of d.months) {
    lines.push(`• ${m.month}: ${signedMoney(m.net)} (รายรับ ${money(m.income)} − รายจ่าย ${money(m.expense)})`);
  }
  return { answer: lines.join("\n"), sources: ["/profit"] };
}

/**
 * render ผลของ tool ตามชื่อ — แต่ละ payload type-safe (cast จาก unknown ที่ tool คืน).
 * คืน null = ถือว่าไม่มีข้อมูล (→ NO_DATA). ชื่อที่ไม่รู้จัก → null.
 */
function renderByTool(toolName: string, data: unknown): AssistantAnswer | null {
  switch (toolName) {
    case "getProfitSummary":
      return renderProfit(data as ProfitPayload);
    case "getBudgetStatus":
      return renderBudget(data as BudgetPayload);
    case "getGoalProgress":
      return renderGoal(data as GoalPayload);
    case "getLowMarginProducts":
      return renderMargin(data as MarginPayload);
    case "getRecurringStatus":
      return renderRecurring(data as RecurringPayload);
    case "getVatSummary":
      return renderVat(data as VatPayload);
    case "getSpendingTrend":
      return renderTrend(data as TrendPayload);
    default:
      return null;
  }
}

/**
 * ตอบแบบ deterministic. ไม่เคย throw (catch ในตัว) — คืนข้อความไทยเสมอ.
 */
export async function answerDeterministic(userId: string, question: string): Promise<AssistantAnswer> {
  const norm = normalize(question);

  // 1) ถ้าเป็นคำถาม how-to ชัดเจน (มี hint) ลองจับ FAQ ก่อน
  const looksHowTo = HOWTO_HINTS.some((h) => norm.includes(h));
  if (looksHowTo) {
    const faq = matchFaq(norm);
    if (faq) return { answer: faq.answer, sources: [faq.href] };
  }

  // 2) จับ intent ข้อมูล (เจาะจงก่อนกว้าง)
  for (const intent of DATA_INTENTS) {
    if (intent.keywords.some((kw) => norm.includes(kw.toLowerCase()))) {
      try {
        const t = tool(intent.tool);
        const parsed = t.inputSchema.safeParse({});
        const data = await t.run(userId, parsed.success ? (parsed.data as Record<string, unknown>) : {});
        const out = renderByTool(intent.tool, data);
        if (out) return out;
        return { answer: NO_DATA, sources: ["/"] }; // ขอบเขตตรงแต่ไม่มีข้อมูล (AI-5)
      } catch {
        // tool พัง → โยนให้ action จัดการ fallback/ERROR_FALLBACK
        throw new Error("tool failed");
      }
    }
  }

  // 3) ไม่มี hint how-to แต่ keyword อาจตรง FAQ (เช่น "แนบใบเสร็จ", "ส่งออก csv")
  const faq = matchFaq(norm);
  if (faq) return { answer: faq.answer, sources: [faq.href] };

  // 4) นอกขอบเขต — ปฏิเสธสุภาพ (AI-4)
  return { answer: OUT_OF_SCOPE };
}
