/**
 * Thai seed — "ร้านนภาพาณิชย์" (โจทย์ 02 · บันทึกค่าใช้จ่ายร้านค้าเล็ก).
 *
 * สร้าง demo user เดียว (napha@example.com / 123456789) ที่เป็นเจ้าของข้อมูลทั้งหมด
 * ครอบคลุม 3 เดือน (เดือนปัจจุบันแบบกลางเดือน + 2 เดือนก่อนหน้า) เพื่อให้ทุก DoD/F/EDGE
 * มีข้อมูลให้เห็นจริง:
 *   - กำไรสุทธิ รายวัน/รายเดือน + เทียบเดือนก่อน (DoD-3, F3)
 *   - หมวด + งบ → มีหมวด "ค่าวัตถุดิบ" ที่ใช้ "เกินงบ" เดือนนี้ (DoD-2, F2)
 *   - เป้ารายได้/เพดานรายจ่ายเดือนนี้ (DoD-4, F4)
 *   - สินค้า: มาม่า ต้นทุน 3 / ขาย 6 = margin 50% (DoD-5) + สินค้า margin ต่ำ (F5 เตือน)
 *   - ค่าใช้จ่ายประจำ "ค่าเช่าร้าน" 3,000/เดือน + ข้ามเฉพาะเดือน (F6, EDGE-3)
 *   - ประวัติการแก้ไขรายการ + เหตุผล (F7, EDGE-1)
 *   - บางรายการคิด VAT 7% (N3)
 *
 * Money = สตางค์ (integer) ทุกที่. occurredAt อิงเวลาไทย (Asia/Bangkok, UTC+7).
 */

import { PrismaClient, EntryType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// --- helpers --------------------------------------------------------------

const BCRYPT_COST = 10; // ต้องตรงกับ src/lib/auth.ts เพื่อให้ login ผ่าน
const baht = (b: number): number => Math.round(b * 100); // บาท -> สตางค์

/**
 * แปลงวันที่ "ตามเวลาไทย" เป็น Date (UTC instant) ที่เที่ยงวันเวลาไทยของวันนั้น.
 * เที่ยงวันไทย = 05:00:00Z → อยู่กลางวันไทยเสมอ ไม่ข้ามวันไม่ว่าจะตัดยอดแบบไหน.
 */
function bkk(year: number, month1to12: number, day: number): Date {
  return new Date(Date.UTC(year, month1to12 - 1, day, 5, 0, 0));
}

/** "YYYY-MM" ของเดือน (ใช้กับ Goal.month / RecurringSkip.month) */
function monthKey(year: number, month1to12: number): string {
  return `${year}-${String(month1to12).padStart(2, "0")}`;
}

/** VAT inclusive: ยอดที่กรอกรวม VAT แล้ว → คืนส่วนที่เป็นภาษี (สตางค์) */
function vatPortionSatang(totalSatang: number, ratePct: number): number {
  if (ratePct <= 0) return 0;
  return Math.round(totalSatang - totalSatang / (1 + ratePct / 100));
}

// อ้างอิงปฏิทินจาก "วันนี้จริง" (Asia/Bangkok) → ทุกครั้งที่ seed ข้อมูลจะอยู่ที่เดือนปัจจุบัน/วันนี้
// (เลย demo โชว์กำไรวันนี้ + เดือนนี้ + เทียบเดือนก่อนได้เสมอ ไม่ว่ารันเมื่อไร)
const _bkkNow = new Date(Date.now() + 7 * 3600_000); // shift → UTC+7
const TODAY = {
  y: _bkkNow.getUTCFullYear(),
  m: _bkkNow.getUTCMonth() + 1,
  d: _bkkNow.getUTCDate(),
};
function monthsAgo(n: number): { y: number; m: number } {
  const d = new Date(Date.UTC(TODAY.y, TODAY.m - 1 - n, 1));
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 };
}
const CUR = { y: TODAY.y, m: TODAY.m }; // เดือนปัจจุบัน (partial ถึงวันนี้)
const PREV = monthsAgo(1); // เดือนก่อน (เต็มเดือน)
const PREV2 = monthsAgo(2); // สองเดือนก่อน (เต็มเดือน)

async function main() {
  console.log("เริ่ม seed ข้อมูลร้านนภาพาณิชย์…");

  // --- 1) ลบข้อมูล demo เดิม (idempotent) ก่อนสร้างใหม่ -------------------
  const existing = await prisma.user.findUnique({
    where: { email: "napha@example.com" },
  });
  if (existing) {
    // onDelete: Cascade จัดการ entries/categories/products/recurring/goals/sessions ให้
    await prisma.user.delete({ where: { id: existing.id } });
    console.log("ลบข้อมูล demo เดิมแล้ว");
  }

  // --- 2) demo user --------------------------------------------------------
  const passwordHash = await bcrypt.hash("123456789", BCRYPT_COST);
  const napha = await prisma.user.create({
    data: {
      email: "napha@example.com",
      name: "นภา แซ่ลิ้ม",
      passwordHash,
    },
  });
  const userId = napha.id;

  // --- 3) หมวดหมู่ (รายจ่าย + รายรับ) + งบรายเดือน ------------------------
  // งบ: ค่าวัตถุดิบ 8,000 (เดือนนี้จะใช้ "เกินงบ" → alert), ค่าน้ำค่าไฟ 2,000,
  // ค่าเช่า 3,500, ค่าจ้างพนักงาน 5,000, จิปาถะ 1,500
  const expenseCats = [
    { name: "ค่าวัตถุดิบ", budget: baht(8000) },
    { name: "ค่าเช่าร้าน", budget: baht(3500) },
    { name: "ค่าน้ำค่าไฟ", budget: baht(2000) },
    { name: "ค่าจ้างพนักงาน", budget: baht(5000) },
    { name: "ค่าใช้จ่ายจิปาถะ", budget: baht(1500) },
  ];
  const incomeCats = [
    { name: "ขายหน้าร้าน", budget: null as number | null },
    { name: "ขายของทอด", budget: null as number | null },
  ];

  const catMap = new Map<string, string>(); // name -> id
  for (const c of expenseCats) {
    const row = await prisma.category.create({
      data: { userId, name: c.name, kind: EntryType.expense },
    });
    catMap.set(c.name, row.id);
    if (c.budget != null) {
      // งบรายเดือน (F2.2) — effective ตั้งแต่ "2025-01" (ก่อนข้อมูลตัวอย่าง) → ทุกเดือนเห็นงบนี้ผ่าน carry-forward
      await prisma.categoryBudget.create({
        data: { userId, categoryId: row.id, month: "2025-01", amountSatang: c.budget },
      });
    }
  }
  for (const c of incomeCats) {
    const row = await prisma.category.create({
      data: { userId, name: c.name, kind: EntryType.income },
    });
    catMap.set(c.name, row.id);
  }

  // --- helper สร้าง Entry ---------------------------------------------------
  type EntrySeed = {
    type: EntryType;
    cat: string;
    baht: number;
    date: Date;
    note?: string;
    receiptPath?: string;
    vatRate?: number;
    recurringRuleId?: string;
  };
  const createdEntryIds: Record<string, string> = {};
  async function addEntry(key: string, e: EntrySeed): Promise<string> {
    const amountSatang = baht(e.baht);
    const vatRate = e.vatRate ?? 0;
    const row = await prisma.entry.create({
      data: {
        userId,
        type: e.type,
        categoryId: catMap.get(e.cat) ?? null,
        categoryName: e.cat,
        amountSatang,
        occurredAt: e.date,
        note: e.note ?? null,
        receiptPaths: e.receiptPath ? JSON.stringify([e.receiptPath]) : null,
        vatRate,
        vatAmountSatang: vatPortionSatang(amountSatang, vatRate),
        recurringRuleId: e.recurringRuleId ?? null,
      },
    });
    if (key) createdEntryIds[key] = row.id;
    return row.id;
  }

  // --- 4) ค่าใช้จ่ายประจำ: ค่าเช่าร้าน 3,000/เดือน (F6) ------------------
  const rentRule = await prisma.recurringRule.create({
    data: {
      userId,
      type: EntryType.expense,
      categoryId: catMap.get("ค่าเช่าร้าน"),
      categoryName: "ค่าเช่าร้าน",
      name: "ค่าเช่าร้าน",
      amountSatang: baht(3000),
      dayOfMonth: 1,
      active: true,
    },
  });

  // EDGE-3: ข้ามค่าเช่าเฉพาะ "สองเดือนก่อน" (เม.ย.) — เดือนนั้นเจ้าของบ้านยกเว้นให้
  await prisma.recurringSkip.create({
    data: { ruleId: rentRule.id, month: monthKey(PREV2.y, PREV2.m) },
  });

  // รายการค่าเช่าที่ "ถูกสร้างจากรายการประจำ" — เดือนก่อน + เดือนปัจจุบัน
  // (สองเดือนก่อนถูกข้าม จึงไม่มีรายการ)
  await addEntry("", {
    type: EntryType.expense,
    cat: "ค่าเช่าร้าน",
    baht: 3000,
    date: bkk(PREV.y, PREV.m, 1),
    note: "ค่าเช่าร้าน (รายการประจำ)",
    recurringRuleId: rentRule.id,
  });
  await addEntry("rentCurrent", {
    type: EntryType.expense,
    cat: "ค่าเช่าร้าน",
    baht: 3000,
    date: bkk(CUR.y, CUR.m, 1),
    note: "ค่าเช่าร้าน (รายการประจำ)",
    recurringRuleId: rentRule.id,
  });

  // --- 5) ข้อมูลรายเดือน ---------------------------------------------------
  // ออกแบบตัวเลขให้:
  //   เดือนก่อน (พ.ค.): กำไรสุทธิรวม +6,200 (ใช้เทียบใน DoD-3)
  //   เดือนปัจจุบัน (มิ.ย. ถึงกลางเดือน): กำไรสุทธิรวม +8,500, รายได้สะสม ~13,000 จากเป้า 20,000
  //   วันนี้ (2026-06-02 อิงโจทย์): กำไรสุทธิวันนี้ +300
  //   ค่าวัตถุดิบเดือนนี้ใช้ > งบ 8,000 → over-budget alert (DoD-2/F2)

  // ----- สองเดือนก่อน (เม.ย. 2026) — ให้มี baseline ค่าเฉลี่ยสำหรับ EDGE-4 -----
  await addEntry("", { type: EntryType.income, cat: "ขายหน้าร้าน", baht: 9800, date: bkk(PREV2.y, PREV2.m, 8) });
  await addEntry("", { type: EntryType.income, cat: "ขายของทอด", baht: 4200, date: bkk(PREV2.y, PREV2.m, 15) });
  await addEntry("", { type: EntryType.expense, cat: "ค่าวัตถุดิบ", baht: 5200, date: bkk(PREV2.y, PREV2.m, 6), note: "ของเข้าร้านต้นเดือน" });
  await addEntry("", { type: EntryType.expense, cat: "ค่าน้ำค่าไฟ", baht: 1450, date: bkk(PREV2.y, PREV2.m, 20) });
  await addEntry("", { type: EntryType.expense, cat: "ค่าจ้างพนักงาน", baht: 3000, date: bkk(PREV2.y, PREV2.m, 28) });
  // (ค่าเช่าเดือนนี้ถูกข้าม — ไม่มีรายการ)

  // ----- เดือนก่อน (พ.ค. 2026) — กำไรสุทธิรวม = +6,200 -----
  // รายรับรวม 19,700 ; รายจ่ายรวม 13,500 → +6,200
  await addEntry("", { type: EntryType.income, cat: "ขายหน้าร้าน", baht: 8500, date: bkk(PREV.y, PREV.m, 5) });
  await addEntry("", { type: EntryType.income, cat: "ขายหน้าร้าน", baht: 6500, date: bkk(PREV.y, PREV.m, 17) });
  await addEntry("", { type: EntryType.income, cat: "ขายของทอด", baht: 4700, date: bkk(PREV.y, PREV.m, 22) });
  await addEntry("", { type: EntryType.expense, cat: "ค่าวัตถุดิบ", baht: 6800, date: bkk(PREV.y, PREV.m, 4), note: "ของเข้าร้าน" });
  await addEntry("editDemo", { type: EntryType.expense, cat: "ค่าวัตถุดิบ", baht: 1200, date: bkk(PREV.y, PREV.m, 12), note: "น้ำอัดลม + ขนม (แก้ยอดแล้ว)" });
  await addEntry("", { type: EntryType.expense, cat: "ค่าน้ำค่าไฟ", baht: 1500, date: bkk(PREV.y, PREV.m, 19), note: "ค่าไฟ + ค่าน้ำ", vatRate: 7 });
  await addEntry("", { type: EntryType.expense, cat: "ค่าจ้างพนักงาน", baht: 1000, date: bkk(PREV.y, PREV.m, 25), note: "ลูกจ้างพาร์ทไทม์ (ลูกสาว)" });
  // + ค่าเช่า 3,000 (รายการประจำด้านบน) → รายจ่ายพ.ค. = 6,800+1,200+1,500+1,000+3,000 = 13,500

  // ----- เดือนปัจจุบัน (มิ.ย. 2026, ถึงกลางเดือน 2 มิ.ย. ตามวันนี้ของโจทย์) -----
  // เป้าตัวเลขที่ออกแบบไว้ (internally consistent):
  //   รายรับสะสมเดือนนี้ = 13,000  → เทียบเป้า 20,000 = 65% (DoD-4) ✓
  //   ค่าวัตถุดิบเดือนนี้ = 8,100 > งบ 8,000 → OVER BUDGET alert (DoD-2/F2) ✓
  //   กำไรสุทธิ "วันนี้" (2 มิ.ย.) = +300 (DoD-3 รายวัน) ✓
  //   รายจ่ายเดือนนี้ = 12,500 → กำไรสุทธิเดือน = +500 (เป็นบวก, สมจริงต้นเดือนหลังลงของยกลัง)
  //
  // หมายเหตุ: ตัวเลขตัวอย่างใน DoD (รายเดือน +8,500) เป็นตัวอย่างต่อฟีเจอร์ ไม่ผูกชุดข้อมูลเดียว
  // — seed นี้ยึด "หมวดเกินงบจริง + เป้า 65% + กำไรวันนี้ +300" ให้ครบและสอดคล้องกันเอง.

  // วันที่ 1 มิ.ย. — เปิดบิลต้นเดือน + ลงของยกลัง (มีใบเสร็จแนบ = DoD-1)
  await addEntry("", { type: EntryType.income, cat: "ขายหน้าร้าน", baht: 5400, date: bkk(CUR.y, CUR.m, 1), note: "ยอดขายวันแรกของเดือน" });
  await addEntry("", { type: EntryType.income, cat: "ขายของทอด", baht: 3200, date: bkk(CUR.y, CUR.m, 1), note: "ปาท่องโก๋ + กล้วยทอด" });
  await addEntry("", { type: EntryType.income, cat: "ขายหน้าร้าน", baht: 3500, date: bkk(CUR.y, CUR.m, 1), note: "ขายรอบบ่าย-เย็น" });
  // หมายเหตุ: รูปสลิป/ใบเสร็จเก็บแบบ "ส่วนตัวต่อผู้ใช้" (uploads/<userId>/ เสิร์ฟผ่าน route ที่ตรวจสิทธิ์)
  // จึงไม่แนบรูปตัวอย่างตอน seed — ผู้ใช้แนบเองตอนใช้งานจริง (รองรับหลายรูปต่อรายการ).
  await addEntry("receiptDemo", {
    type: EntryType.expense,
    cat: "ค่าวัตถุดิบ",
    baht: 7500,
    date: bkk(CUR.y, CUR.m, 1),
    note: "ของเข้าร้านต้นเดือน (ยกลัง)",
  });
  await addEntry("", { type: EntryType.expense, cat: "ค่าน้ำค่าไฟ", baht: 1400, date: bkk(CUR.y, CUR.m, 1), note: "ค่าไฟเดือนนี้", vatRate: 7 });

  // ----- รายการ "หลายวันล่าสุด" จนถึงวันนี้ — ให้กราฟรายวัน + hero วันนี้มีข้อมูล -----
  // วันย้อนหลัง (clamp 1..วันนี้ กันวันที่อนาคต ถ้า seed ต้นเดือน)
  const dRecent = (back: number): number => Math.max(1, TODAY.d - back);
  await addEntry("", { type: EntryType.income, cat: "ขายหน้าร้าน", baht: 820, date: bkk(CUR.y, CUR.m, dRecent(7)), note: "ขายหน้าร้าน" });
  await addEntry("", { type: EntryType.income, cat: "ขายของทอด", baht: 540, date: bkk(CUR.y, CUR.m, dRecent(5)), note: "กล้วยทอด + ปาท่องโก๋" });
  await addEntry("", { type: EntryType.expense, cat: "ค่าใช้จ่ายจิปาถะ", baht: 250, date: bkk(CUR.y, CUR.m, dRecent(5)), note: "ถุง + ของใช้ในร้าน" });
  await addEntry("", { type: EntryType.income, cat: "ขายหน้าร้าน", baht: 1100, date: bkk(CUR.y, CUR.m, dRecent(3)), note: "ยอดขายดีช่วงสุดสัปดาห์" });
  await addEntry("", { type: EntryType.income, cat: "ขายของทอด", baht: 430, date: bkk(CUR.y, CUR.m, dRecent(3)), note: "ของทอดรอบบ่าย" });
  await addEntry("", { type: EntryType.income, cat: "ขายหน้าร้าน", baht: 760, date: bkk(CUR.y, CUR.m, dRecent(1)), note: "ขายหน้าร้าน" });

  // วันนี้: รายรับ 950 (600+350), รายจ่าย 600 → กำไรวันนี้ = +350
  await addEntry("", { type: EntryType.income, cat: "ขายหน้าร้าน", baht: 600, date: bkk(CUR.y, CUR.m, TODAY.d), note: "ขายเช้า" });
  await addEntry("", { type: EntryType.income, cat: "ขายของทอด", baht: 350, date: bkk(CUR.y, CUR.m, TODAY.d), note: "กล้วยทอดรอบเช้า" });
  await addEntry("dupDemo", { type: EntryType.expense, cat: "ค่าวัตถุดิบ", baht: 600, date: bkk(CUR.y, CUR.m, TODAY.d), note: "แป้ง + น้ำมันทอด" });

  // สรุป CUR (โดยประมาณ): ค่าวัตถุดิบ 7,500+600 = 8,100 > งบ 8,000 → เกินงบ ✓ ;
  // รายรับสะสม ~16,700 (~83% ของเป้า 20,000) ; กำไรวันนี้ +350 ; กำไรสุทธิเดือนเป็นบวก.

  // --- 6) สินค้า + ต้นทุน/ราคาขาย (F5, DoD-5) ------------------------------
  await prisma.product.createMany({
    data: [
      // DoD-5: มาม่า ต้นทุน 3 / ขาย 6 → margin 50%
      { userId, name: "มาม่าซองใหญ่", costSatang: baht(3), priceSatang: baht(6), lowMarginThresholdPct: 20 },
      // สินค้า margin ต่ำ (เตือน): ถุงหูหิ้ว ต้นทุน 0.90 / ขาย 1.00 → margin 10% < 20%
      { userId, name: "ถุงหูหิ้วใส่ของ", costSatang: baht(0.9), priceSatang: baht(1), lowMarginThresholdPct: 20 },
      // สินค้าปกติ
      { userId, name: "น้ำอัดลมกระป๋อง", costSatang: baht(11), priceSatang: baht(15), lowMarginThresholdPct: 20 },
      { userId, name: "ขนมถุงเด็ก", costSatang: baht(4), priceSatang: baht(5), lowMarginThresholdPct: 15 },
      { userId, name: "กล้วยทอด (ถุง)", costSatang: baht(7), priceSatang: baht(20), lowMarginThresholdPct: 20 },
    ],
  });

  // --- 7) เป้าหมายเดือนนี้ (F4, DoD-4) -------------------------------------
  // รายรับเป้า 20,000 ; เพดานรายจ่าย 15,000. รายรับสะสมเดือนนี้ ~13,000 → ~65%.
  await prisma.goal.create({
    data: {
      userId,
      month: monthKey(CUR.y, CUR.m),
      incomeTargetSatang: baht(20000),
      expenseTargetSatang: baht(15000),
    },
  });
  // เป้าเดือนก่อน (ให้หน้า /goals มีประวัติ)
  await prisma.goal.create({
    data: {
      userId,
      month: monthKey(PREV.y, PREV.m),
      incomeTargetSatang: baht(18000),
      expenseTargetSatang: baht(14000),
    },
  });

  // --- 8) ประวัติการแก้ไขรายการ (F7, EDGE-1) ------------------------------
  // จำลองว่าเคยกรอกยอด "น้ำอัดลม + ขนม" ผิดเป็น 2,100 แล้วแก้เป็น 1,200 พร้อมเหตุผล
  const editEntryId = createdEntryIds["editDemo"];
  if (editEntryId) {
    await prisma.entryRevision.create({
      data: {
        entryId: editEntryId,
        userId,
        field: "amountSatang",
        oldValue: String(baht(2100)),
        newValue: String(baht(1200)),
        reason: "กรอกยอดผิด นับเงินทอนสลับใบ แก้ให้ตรงสลิป",
      },
    });
  }

  // --- 9) สรุปผล ----------------------------------------------------------
  const counts = {
    users: await prisma.user.count(),
    categories: await prisma.category.count({ where: { userId } }),
    entries: await prisma.entry.count({ where: { userId } }),
    products: await prisma.product.count({ where: { userId } }),
    recurringRules: await prisma.recurringRule.count({ where: { userId } }),
    recurringSkips: await prisma.recurringSkip.count({ where: { rule: { userId } } }),
    goals: await prisma.goal.count({ where: { userId } }),
    revisions: await prisma.entryRevision.count({ where: { userId } }),
  };

  console.log("seed สำเร็จ ✓");
  console.log("  demo login → email: napha@example.com  password: 123456789");
  console.log("  ข้อมูล:", JSON.stringify(counts));
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("seed ล้มเหลว:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
