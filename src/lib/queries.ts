import "server-only";

/**
 * Per-user read layer. ทุก query ผูก userId เสมอ (AUTH-3).
 * การจัดกลุ่มวัน/เดือน อิงเวลาไทย (Asia/Bangkok) ผ่าน helper ใน dates.ts.
 */

import { prisma } from "@/lib/db";
import { marginPct } from "@/lib/calc";
import {
  bkkMonthRange,
  bkkDayRange,
  currentMonthKey,
  todayDateKey,
  prevMonthKey,
  bkkMonthKey,
  bkkDateKey,
  bkkDateKeyToInstant,
  bkkMonthKey as bkkMonthKeyOf,
  formatThaiDate,
} from "@/lib/dates";

export type EntryKind = "income" | "expense";

/**
 * เลื่อน dateKey "YYYY-MM-DD" ไป n วัน (อิงปฏิทินเวลาไทย) — ต่อยอด helper เดิมใน dates.ts
 * (bkkDateKeyToInstant → +n วัน → bkkDateKey) จึงไม่ทำ tz math ซ้ำ.
 * คืนค่าเดิมถ้า dateKey ผิดรูป (กัน NaN).
 */
export function shiftDateKey(dateKey: string, n: number): string {
  const instant = bkkDateKeyToInstant(dateKey);
  if (!instant) return dateKey;
  return bkkDateKey(new Date(instant.getTime() + n * 24 * 60 * 60 * 1000));
}

/** dateKey นี้คือ "วันนี้" (เวลาไทย) หรือไม่ — ใช้ตัดสินใจหัวข้อ/ปิดปุ่มอนาคต. */
export function isTodayKey(dateKey: string): boolean {
  return dateKey === todayDateKey();
}

/** monthKey "YYYY-MM" ที่ dateKey สังกัด (เวลาไทย) — ใช้ผูกสรุปงบ/เป้า/สินค้าให้ตรงเดือนที่เลือก. */
export function monthKeyOfDay(dateKey: string): string {
  const instant = bkkDateKeyToInstant(dateKey);
  if (!instant) return dateKey.slice(0, 7);
  return bkkMonthKeyOf(instant);
}

/** รวมรายรับ-รายจ่าย-กำไรสุทธิ ในช่วงเวลาหนึ่ง (สตางค์). */
export type Totals = { income: number; expense: number; net: number };

async function sumByType(
  userId: string,
  range: { gte: Date; lt: Date },
): Promise<Totals> {
  const rows = await prisma.entry.groupBy({
    by: ["type"],
    where: { userId, deletedAt: null, occurredAt: { gte: range.gte, lt: range.lt } },
    _sum: { amountSatang: true },
  });
  let income = 0;
  let expense = 0;
  for (const r of rows) {
    if (r.type === "income") income = r._sum.amountSatang ?? 0;
    else expense = r._sum.amountSatang ?? 0;
  }
  return { income, expense, net: income - expense };
}

/**
 * กำไรสุทธิของ "วันใดวันหนึ่ง" (เวลาไทย, dateKey YYYY-MM-DD). (DoD-3 รายวัน, K ดูย้อนหลัง)
 * เป็นรูปทั่วไปของ todayTotals — หน้า Home เลือกวันได้ผ่าน ?d=.
 */
export function dayTotals(userId: string, dateKey: string): Promise<Totals> {
  return sumByType(userId, bkkDayRange(dateKey));
}

/** กำไรสุทธิวันนี้ (เวลาไทย). (DoD-3 รายวัน) — wrapper บน dayTotals(วันนี้). */
export function todayTotals(userId: string): Promise<Totals> {
  return dayTotals(userId, todayDateKey());
}

/**
 * กำไรสุทธิ "วันก่อนหน้า dateKey" (เวลาไทย) — ใช้เทียบอารมณ์ใน hero (ดีกว่า/น้อยกว่าวันก่อน).
 * คงตรรกะ "ช่วง 24 ชม. ก่อนหน้า" เดิม (กันขอบเขตข้ามวันเพี้ยน).
 */
export function prevDayTotals(userId: string, dateKey: string): Promise<Totals> {
  const dayRange = bkkDayRange(dateKey);
  const lt = dayRange.gte;
  const gte = new Date(lt.getTime() - 24 * 60 * 60 * 1000);
  return sumByType(userId, { gte, lt });
}

/** กำไรสุทธิ "เมื่อวาน" (เวลาไทย) — wrapper บน prevDayTotals(วันนี้). */
export function yesterdayTotals(userId: string): Promise<Totals> {
  return prevDayTotals(userId, todayDateKey());
}

/** กำไรสุทธิเดือนนี้ (เวลาไทย). */
export function monthTotals(userId: string, monthKey?: string): Promise<Totals> {
  return sumByType(userId, bkkMonthRange(monthKey ?? currentMonthKey()));
}

/**
 * สรุปกำไรเดือน + เดือนก่อน (สำหรับเทียบ %) พร้อมยอด "ของวันที่เลือก". (DoD-3, F3, K)
 * - dateKey: วันที่กำลังดู (ค่าเริ่มต้น = วันนี้). เดือนที่ใช้สรุป = เดือนที่ dateKey สังกัด
 *   ดังนั้น goal progress / เทียบเดือน จะอิงเดือนของวันที่เลือกโดยอัตโนมัติ.
 * - คืน `today` = ยอดของวันที่เลือก (ชื่อ field คงเดิมเพื่อ backward-compat กับ Home),
 *   `prevDay` = ยอดวันก่อนหน้า สำหรับเทียบอารมณ์ใน hero.
 */
export async function profitComparison(userId: string, dateKey?: string) {
  const day = dateKey ?? todayDateKey();
  const cur = monthKeyOfDay(day);
  const prev = prevMonthKey(cur);
  const [current, previous, today, prevDay] = await Promise.all([
    monthTotals(userId, cur),
    monthTotals(userId, prev),
    dayTotals(userId, day),
    prevDayTotals(userId, day),
  ]);
  return { dateKey: day, monthKey: cur, prevMonthKey: prev, current, previous, today, prevDay };
}

/** กำไรสุทธิรายวันของเดือน (เวลาไทย) สำหรับกราฟ. */
export async function dailyNetSeries(userId: string, monthKey?: string) {
  const mk = monthKey ?? currentMonthKey();
  const range = bkkMonthRange(mk);
  const entries = await prisma.entry.findMany({
    where: { userId, deletedAt: null, occurredAt: { gte: range.gte, lt: range.lt } },
    select: { type: true, amountSatang: true, occurredAt: true },
    orderBy: { occurredAt: "asc" },
  });
  // group by day (เวลาไทย)
  const byDay = new Map<number, { income: number; expense: number }>();
  for (const e of entries) {
    // อ่านวันที่ตามเวลาไทย
    const shifted = new Date(e.occurredAt.getTime() + 7 * 60 * 60 * 1000);
    const day = shifted.getUTCDate();
    const acc = byDay.get(day) ?? { income: 0, expense: 0 };
    if (e.type === "income") acc.income += e.amountSatang;
    else acc.expense += e.amountSatang;
    byDay.set(day, acc);
  }
  return [...byDay.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([day, v]) => ({ day, net: v.income - v.expense, income: v.income, expense: v.expense }));
}

/** กำไรสุทธิรายเดือน `count` เดือน นับถอยหลังจาก `endMonthKey` (ดีฟอลต์ = เดือนปัจจุบัน) สำหรับกราฟรายเดือน. */
export async function monthlyNetSeries(userId: string, count = 6, endMonthKey?: string) {
  const cur = endMonthKey ?? currentMonthKey();
  const keys: string[] = [];
  let k = cur;
  for (let i = 0; i < count; i++) {
    keys.unshift(k);
    k = prevMonthKey(k);
  }
  const results = await Promise.all(keys.map((mk) => monthTotals(userId, mk)));
  return keys.map((mk, i) => ({
    monthKey: mk,
    net: results[i].net,
    income: results[i].income,
    expense: results[i].expense,
  }));
}

/** หมวด + ยอดใช้จริงเดือนนี้ + งบ + คงเหลือ. (DoD-2, F2) */
export type BudgetRow = {
  categoryId: string;
  name: string;
  kind: EntryKind;
  budgetSatang: number | null;
  actualSatang: number;
  remainingSatang: number | null;
};

export async function categorySummaries(
  userId: string,
  monthKey?: string,
): Promise<BudgetRow[]> {
  const mk = monthKey ?? currentMonthKey();
  const isCurrent = mk === currentMonthKey();
  const range = bkkMonthRange(mk);

  const [activeCats, sums, budgetRows] = await Promise.all([
    prisma.category.findMany({
      where: { userId, archived: false },
      orderBy: [{ kind: "asc" }, { createdAt: "asc" }],
    }),
    // จัดกลุ่มตาม id + ชื่อ snapshot → ยอดใช้จริงของเดือนนั้น + ชื่อ ณ ตอนบันทึก (immutable ต่อเดือน)
    prisma.entry.groupBy({
      by: ["categoryId", "categoryName"],
      where: { userId, deletedAt: null, occurredAt: { gte: range.gte, lt: range.lt } },
      _sum: { amountSatang: true },
    }),
    // งบ effective-dated (F2.2): ทุกแถวที่ month <= เดือนที่ดู — carry-forward เอาค่าเดือนล่าสุดสุด
    prisma.categoryBudget.findMany({
      where: { userId, month: { lte: mk } },
      orderBy: { month: "asc" },
      select: { categoryId: true, amountSatang: true },
    }),
  ]);

  // ยอดใช้จริง + ชื่อตัวแทน (snapshot ที่มียอดมากสุด) ต่อ categoryId ของเดือนนั้น
  const spentByCat = new Map<string, number>();
  const snapNameByCat = new Map<string, { name: string; spend: number }>();
  for (const s of sums) {
    if (!s.categoryId) continue;
    const amt = s._sum.amountSatang ?? 0;
    spentByCat.set(s.categoryId, (spentByCat.get(s.categoryId) ?? 0) + amt);
    const cur = snapNameByCat.get(s.categoryId);
    if (!cur || amt > cur.spend) snapNameByCat.set(s.categoryId, { name: s.categoryName, spend: amt });
  }

  // เรียง month asc → ค่าเดือนใหม่สุดที่ <= mk จะทับท้าย (carry-forward); null = ยกเลิกงบ
  const budgetByCat = new Map<string, number | null>();
  for (const b of budgetRows) budgetByCat.set(b.categoryId, b.amountSatang);

  // หมวดที่ "เกี่ยวกับเดือนนี้":
  //  - เดือนปัจจุบัน = "มุมมองสด": แสดงเฉพาะหมวดที่ "ยังไม่ถูกลบ" (active) เท่านั้น
  //    → ลบ/แก้หมวดสะท้อนทันที (หมวดที่ลบจะหายจากหน้านี้แม้เคยมียอดในเดือนนี้)
  //  - เดือนย้อนหลัง = "บันทึกแช่แข็ง": เฉพาะหมวดที่ "มีรายการ" หรือ "มีงบ" ในเดือนนั้น
  //    (รวมหมวดที่ถูกลบ/แก้ชื่อภายหลัง) → แก้/ลบหมวดภายหลังไม่กระทบเดือนย้อนหลัง
  const activeById = new Map(activeCats.map((c) => [c.id, c]));
  const neededIds = new Set<string>();
  if (isCurrent) {
    for (const c of activeCats) neededIds.add(c.id);
  } else {
    for (const id of spentByCat.keys()) neededIds.add(id);
    for (const [id, amt] of budgetByCat) if (amt != null) neededIds.add(id);
  }

  // หมวดที่ถูกลบ (archived) แต่มีข้อมูลในเดือนนั้น — ดึง record มาเพื่อรู้ kind (ชื่อใช้ snapshot)
  const missingIds = [...neededIds].filter((id) => !activeById.has(id));
  const extra = missingIds.length
    ? await prisma.category.findMany({ where: { userId, id: { in: missingIds } } })
    : [];
  const recById = new Map([...activeCats, ...extra].map((c) => [c.id, c]));

  const built = [...neededIds]
    .map((id) => recById.get(id))
    .filter((c): c is NonNullable<typeof c> => !!c)
    .map((c) => {
      const budget = budgetByCat.get(c.id) ?? null;
      // ชื่อ: เดือนปัจจุบัน = ชื่อหมวดล่าสุด (แก้ชื่อแล้วเห็นทันที); เดือนย้อนหลัง = ชื่อ ณ ตอนบันทึก
      const name = isCurrent ? c.name : snapNameByCat.get(c.id)?.name ?? c.name;
      const actual = spentByCat.get(c.id) ?? 0;
      const row: BudgetRow = {
        categoryId: c.id,
        name,
        kind: c.kind as EntryKind,
        budgetSatang: budget,
        actualSatang: actual,
        remainingSatang: budget == null ? null : budget - actual,
      };
      return { rec: c, row };
    });

  // เรียง: kind asc แล้วตาม createdAt (คงลำดับเดิม)
  built.sort((a, b) => {
    if (a.rec.kind !== b.rec.kind) return a.rec.kind < b.rec.kind ? -1 : 1;
    return a.rec.createdAt.getTime() - b.rec.createdAt.getTime();
  });

  return built.map((b) => b.row);
}

/**
 * เดือน (YYYY-MM, เวลาไทย) ที่ "มีข้อมูล" อย่างน้อย 1 รายการ — สำหรับตัวกรองเดือน
 * ในหน้าสรุปรายจ่าย & งบประมาณ. จัดกลุ่มตามเวลาไทยใน JS (แนวเดียวกับ dailyNetSeries)
 * กัน tz เพี้ยน; รวม "เดือนปัจจุบัน" เสมอ เพื่อให้เลือกดูเดือนนี้ได้แม้ยังไม่มีรายการ.
 * เรียงใหม่ → เก่า ให้ dropdown ขึ้นเดือนล่าสุดก่อน.
 */
export async function monthsWithEntries(userId: string): Promise<string[]> {
  const rows = await prisma.entry.findMany({
    where: { userId, deletedAt: null },
    select: { occurredAt: true },
  });
  const set = new Set<string>([currentMonthKey()]);
  for (const r of rows) set.add(bkkMonthKey(r.occurredAt));
  return [...set].sort((a, b) => (a < b ? 1 : -1));
}

/** ขอบเขตของโน้ต (feature note): รวม / รายวัน / รายเดือน. */
export type NoteScope = "global" | "daily" | "monthly";

/**
 * โน้ตของขอบเขตหนึ่ง (รวม/รายวัน/รายเดือน) — คืน null ถ้ายังไม่เคยบันทึก.
 * scopeKey: global -> "" ; daily -> "YYYY-MM-DD" ; monthly -> "YYYY-MM".
 */
export async function getNote(userId: string, scope: NoteScope, scopeKey: string) {
  return prisma.note.findFirst({
    where: { userId, scope, scopeKey, deletedAt: null },
  });
}

/**
 * Top หมวด "กำไรดี" — หมวด "รายรับ" ที่ทำเงินรวมมากที่สุด (ทุกช่วงเวลา).
 * (หมวดรายรับ = ตัวขับกำไรของร้าน; จัดกลุ่มด้วย categoryName snapshot จึงทนต่อหมวดที่ถูกลบ.)
 */
export type TopCategory = { name: string; totalSatang: number; count: number };
export async function topProfitCategories(userId: string, limit = 10): Promise<TopCategory[]> {
  const rows = await prisma.entry.groupBy({
    by: ["categoryName"],
    where: { userId, deletedAt: null, type: "income" },
    _sum: { amountSatang: true },
    _count: true,
  });
  return rows
    .map((r) => ({ name: r.categoryName, totalSatang: r._sum.amountSatang ?? 0, count: r._count }))
    .filter((r) => r.totalSatang > 0)
    .sort((a, b) => b.totalSatang - a.totalSatang)
    .slice(0, limit);
}

/** Top สินค้า "กำไรดี" — อัตรากำไรขั้นต้น (margin%) สูงสุด (เสมอกันตัดด้วยกำไร/หน่วยมากกว่า). */
export type TopProduct = {
  id: string;
  name: string;
  costSatang: number;
  priceSatang: number;
  grossSatang: number; // กำไรขั้นต้นต่อหน่วย (ราคา − ต้นทุน)
  marginPct: number;
};
export async function topProfitProducts(userId: string, limit = 10): Promise<TopProduct[]> {
  const products = await prisma.product.findMany({ where: { userId, archived: false } });
  return products
    .filter((p) => p.priceSatang > 0)
    .map((p) => ({
      id: p.id,
      name: p.name,
      costSatang: p.costSatang,
      priceSatang: p.priceSatang,
      grossSatang: p.priceSatang - p.costSatang,
      marginPct: marginPct(p.costSatang, p.priceSatang),
    }))
    .sort((a, b) => b.marginPct - a.marginPct || b.grossSatang - a.grossSatang)
    .slice(0, limit);
}

/** เป้าเดือนนี้ (F4, DoD-4) — คืน null ถ้ายังไม่ตั้ง. */
export async function getGoal(userId: string, monthKey?: string) {
  const mk = monthKey ?? currentMonthKey();
  return prisma.goal.findUnique({ where: { userId_month: { userId, month: mk } } });
}

/** สินค้า (F5, DoD-5). */
export function listProducts(userId: string) {
  return prisma.product.findMany({
    where: { userId, archived: false },
    orderBy: { createdAt: "asc" },
  });
}

/** หมวดทั้งหมด (N2) — แยกประเภทไว้ให้ฟอร์มเลือก. */
export async function listCategories(userId: string) {
  return prisma.category.findMany({
    where: { userId, archived: false },
    orderBy: [{ kind: "asc" }, { createdAt: "asc" }],
  });
}

/** จำนวนรายการที่ใช้หมวดนี้ (N2: เตือนก่อนลบ). */
export function countEntriesForCategory(userId: string, categoryId: string) {
  return prisma.entry.count({ where: { userId, categoryId, deletedAt: null } });
}

export type EntryFilter = {
  type?: EntryKind;
  categoryId?: string;
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
};

/** รายการทั้งหมด + ตัวกรอง (F1 ลิสต์, F7, N1). */
export async function listEntries(userId: string, filter: EntryFilter = {}) {
  const where: {
    userId: string;
    deletedAt: null;
    type?: EntryKind;
    categoryId?: string;
    occurredAt?: { gte?: Date; lt?: Date };
  } = { userId, deletedAt: null };
  if (filter.type) where.type = filter.type;
  if (filter.categoryId) where.categoryId = filter.categoryId;
  if (filter.from || filter.to) {
    where.occurredAt = {};
    if (filter.from) where.occurredAt.gte = bkkDayRange(filter.from).gte;
    if (filter.to) where.occurredAt.lt = bkkDayRange(filter.to).lt;
  }
  return prisma.entry.findMany({
    where,
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
    include: { _count: { select: { revisions: true } } },
  });
}

/** รายการของวันใดวันหนึ่ง (เวลาไทย, dateKey YYYY-MM-DD) — รูปทั่วไปของ todayEntries (K ดูย้อนหลัง). */
export async function dayEntries(userId: string, dateKey: string) {
  const range = bkkDayRange(dateKey);
  return prisma.entry.findMany({
    where: { userId, deletedAt: null, occurredAt: { gte: range.gte, lt: range.lt } },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { revisions: true } } },
  });
}

/** รายการวันนี้ (Today page) — wrapper บน dayEntries(วันนี้). */
export function todayEntries(userId: string) {
  return dayEntries(userId, todayDateKey());
}

/** รายการเดียว + ประวัติแก้ไข (F7) — ผูก userId กัน IDOR. */
export async function getEntryWithRevisions(userId: string, entryId: string) {
  return prisma.entry.findFirst({
    where: { id: entryId, userId, deletedAt: null },
    include: { revisions: { orderBy: { createdAt: "desc" } } },
  });
}

/** ค่าใช้จ่ายประจำ + สถานะเดือนนี้ (F6, EDGE-3). */
export async function listRecurring(userId: string, monthKey?: string) {
  const mk = monthKey ?? currentMonthKey();
  const rules = await prisma.recurringRule.findMany({
    where: { userId, deletedAt: null },
    orderBy: { createdAt: "asc" },
    include: {
      skips: { where: { month: mk } },
      generatedEntries: {
        where: {
          deletedAt: null,
          occurredAt: bkkMonthRange(mk),
        },
        select: { id: true },
      },
    },
  });
  return rules.map((r) => ({
    ...r,
    skippedThisMonth: r.skips.length > 0,
    generatedThisMonth: r.generatedEntries.length > 0,
  }));
}

/**
 * ค่าเฉลี่ยยอดของหมวด (สำหรับ EDGE-4 "ยอดสูงผิดปกติ").
 * ใช้ค่าเฉลี่ยรายการในหมวดเดียวกัน (ทุกเดือน). ถ้ายังไม่มี baseline -> null.
 */
export async function categoryAverageSatang(
  userId: string,
  categoryId: string,
): Promise<number | null> {
  const agg = await prisma.entry.aggregate({
    where: { userId, categoryId, deletedAt: null },
    _avg: { amountSatang: true },
    _count: true,
  });
  if (agg._count < 3) return null; // ข้อมูลน้อยเกินไป ไม่เตือน
  return agg._avg.amountSatang ?? null;
}

/** สรุป VAT รายเดือน (N3): ภาษีขาย (income), ภาษีซื้อ (expense), สุทธิ + จำนวนรายการที่มี VAT. */
export type VatSummary = {
  outputVatSatang: number; // ภาษีขาย (จากรายรับ)
  inputVatSatang: number; // ภาษีซื้อ (จากรายจ่าย)
  netVatSatang: number; // ภาษีขาย − ภาษีซื้อ (ที่ต้องนำส่ง โดยประมาณ)
  outputBaseSatang: number; // ฐานรายรับที่มี VAT (ก่อน VAT)
  vatEntryCount: number; // จำนวนรายการที่คิด VAT
};

export async function monthlyVatSummary(userId: string, monthKey?: string): Promise<VatSummary> {
  const range = bkkMonthRange(monthKey ?? currentMonthKey());
  const where = { userId, deletedAt: null, vatRate: { gt: 0 }, occurredAt: { gte: range.gte, lt: range.lt } } as const;

  const [byType, count] = await Promise.all([
    prisma.entry.groupBy({
      by: ["type"],
      where,
      _sum: { vatAmountSatang: true, amountSatang: true },
    }),
    prisma.entry.count({ where }),
  ]);

  let outputVat = 0;
  let inputVat = 0;
  let outputTotal = 0;
  for (const r of byType) {
    if (r.type === "income") {
      outputVat = r._sum.vatAmountSatang ?? 0;
      outputTotal = r._sum.amountSatang ?? 0;
    } else {
      inputVat = r._sum.vatAmountSatang ?? 0;
    }
  }
  return {
    outputVatSatang: outputVat,
    inputVatSatang: inputVat,
    netVatSatang: outputVat - inputVat,
    outputBaseSatang: outputTotal - outputVat,
    vatEntryCount: count,
  };
}

/** ยอดภาษีขาย (VAT) รวมเดือนนี้ (N3, เดิม) — wrapper บนสรุป VAT. */
export async function monthlyVatTotal(userId: string, monthKey?: string) {
  const s = await monthlyVatSummary(userId, monthKey);
  return s.outputVatSatang;
}

/** dateKey "YYYY-MM-DD" -> ข้อความวันที่ไทยสั้น เช่น "2 มิ.ย. 69" (ผ่าน helper เดิม). */
export function formatThaiDayKey(dateKey: string): string {
  const instant = bkkDateKeyToInstant(dateKey);
  if (!instant) return dateKey;
  return formatThaiDate(instant);
}

export { currentMonthKey, todayDateKey, bkkMonthKey };
