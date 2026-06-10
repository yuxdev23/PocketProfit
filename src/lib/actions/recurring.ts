"use server";

/**
 * Server actions + auto-generate สำหรับค่าใช้จ่ายประจำ (F6, EDGE-3).
 * ทุก action: requireUser() + re-validate ด้วย zod + ผูก userId เสมอ (ไม่เชื่อ client).
 *
 * หลักการ auto-generate (F6): "idempotent per month".
 *   ensureRecurringForCurrentMonth() ถูกเรียกฝั่ง server ตอนโหลดหน้า (หน้าหลัก/รายการ/ประจำ)
 *   → สำหรับทุก rule ที่ active และยังไม่ถูกข้ามเดือนนี้ และยังไม่เคยสร้าง → สร้าง Entry 1 รายการ.
 *   ใช้ recurringRuleId + ช่วงเดือน เป็นกุญแจกันสร้างซ้ำ (กดรีเฟรชหลายครั้งก็ไม่ซ้ำ).
 *
 * EDGE-3 (ข้ามเฉพาะเดือน): skip → ลบรายการที่ระบบสร้างของเดือนนั้น (ถ้ามี) + บันทึก RecurringSkip
 *   → ยอดเดือนนั้นไม่รวมรายการที่ข้าม แต่ "รูปแบบรายการประจำยังอยู่" เดือนถัดไปกลับมาปกติ.
 */

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { recurringSchema } from "@/lib/validation";
import { bahtToSatang } from "@/lib/money";
import {
  currentMonthKey,
  bkkMonthRange,
  bkkDateKeyToInstant,
  todayDateKey,
} from "@/lib/dates";
import type { ActionResult } from "@/lib/actions/types";

const MONTH_KEY_RE = /^\d{4}-\d{2}$/;

/** วันลงรายการของเดือน = min(dayOfMonth, วันนี้ถ้าเป็นเดือนปัจจุบัน) เพื่อไม่ลงวันอนาคต. */
function occurrenceDateKey(monthKey: string, dayOfMonth: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const day = Math.min(Math.max(dayOfMonth, 1), 28);
  let key = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  // กันลงวันอนาคต: ถ้าเป็นเดือนปัจจุบันและวันที่กำหนดยังมาไม่ถึง ใช้ "วันนี้" แทน
  const today = todayDateKey();
  if (monthKey === currentMonthKey() && key > today) key = today;
  return key;
}

/**
 * Auto-generate รายการของ "เดือนใดก็ได้" (monthKey "YYYY-MM" เวลาไทย) ให้ครบทุก rule
 * ที่ยัง active + ไม่ถูกข้าม (F6). Idempotent per recurringRuleId + ช่วงเดือน:
 * ถ้ามีรายการของ rule นั้นในเดือนนั้นแล้ว จะข้าม — เรียกซ้ำกี่ครั้ง/กดปุ่มกี่ที ก็ไม่สร้างซ้ำ.
 * คืนจำนวนรายการที่เพิ่งสร้าง (ไว้ revalidate / แจ้งผู้ใช้).
 */
export async function generateRecurringForMonth(userId: string, monthKey: string): Promise<number> {
  const month = MONTH_KEY_RE.test(monthKey) ? monthKey : currentMonthKey();
  const range = bkkMonthRange(month);

  const rules = await prisma.recurringRule.findMany({
    where: { userId, active: true, deletedAt: null },
    include: {
      skips: { where: { month }, select: { id: true } },
      generatedEntries: {
        where: { deletedAt: null, occurredAt: { gte: range.gte, lt: range.lt } },
        select: { id: true },
      },
    },
  });

  let created = 0;
  for (const r of rules) {
    if (r.skips.length > 0) continue; // ถูกข้ามเดือนนี้ (EDGE-3)
    if (r.generatedEntries.length > 0) continue; // สร้างไปแล้ว — กันซ้ำ

    const dateKey = occurrenceDateKey(month, r.dayOfMonth);
    const occurredAt = bkkDateKeyToInstant(dateKey);
    if (!occurredAt) continue;

    try {
      await prisma.entry.create({
        data: {
          userId,
          type: r.type,
          categoryId: r.categoryId,
          categoryName: r.categoryName,
          amountSatang: r.amountSatang,
          occurredAt,
          note: `${r.name} (รายการประจำ)`,
          recurringRuleId: r.id,
        },
      });
      created++;
    } catch {
      // ถ้ามี race สร้างพร้อมกัน — ข้ามไป รอบหน้า idempotent จับได้เอง
    }
  }
  return created;
}

/**
 * Wrapper เดิม (F6) — สร้างรายการของ "เดือนปัจจุบัน". หน้าหลัก/รายการ/ประจำ เรียกตอนโหลด.
 * คงไว้เพื่อความเข้ากันได้ของจุดเรียกเดิม (delegate ไป generateRecurringForMonth).
 */
export async function ensureRecurringForCurrentMonth(userId: string): Promise<number> {
  return generateRecurringForMonth(userId, currentMonthKey());
}

/**
 * นับจำนวนรายการที่ "จะถูกสร้าง" สำหรับเดือนที่เลือก (preview ของปุ่มสร้างเอง) —
 * นับเฉพาะ rule ที่ active, ยังไม่ถูกข้ามเดือนนั้น, และยังไม่เคยสร้างในเดือนนั้น.
 * อ่านอย่างเดียว (ไม่สร้างจริง) เพื่อโชว์เลขบนปุ่ม "สร้างรายการประจำ (N)".
 */
export async function countRecurringToGenerate(userId: string, monthKey: string): Promise<number> {
  const month = MONTH_KEY_RE.test(monthKey) ? monthKey : currentMonthKey();
  const range = bkkMonthRange(month);

  const rules = await prisma.recurringRule.findMany({
    where: { userId, active: true, deletedAt: null },
    select: {
      skips: { where: { month }, select: { id: true } },
      generatedEntries: {
        where: { deletedAt: null, occurredAt: { gte: range.gte, lt: range.lt } },
        select: { id: true },
      },
    },
  });

  return rules.filter((r) => r.skips.length === 0 && r.generatedEntries.length === 0).length;
}

/**
 * Action ปุ่ม "สร้างรายการประจำ" ของเดือนที่ผู้ใช้กำลังดู (manual generate).
 * requireUser + validate monthKey + ผูก userId เสมอ. Idempotent — กดซ้ำไม่สร้างซ้ำ.
 * คืนจำนวนที่เพิ่งสร้าง เพื่อให้ฝั่ง client ขึ้น toast ภาษาไทยที่เป็นมิตร.
 */
export async function runRecurringForMonth(
  monthKey: string,
): Promise<{ ok: true; created: number } | { ok: false; error: string }> {
  const user = await requireUser();
  if (!MONTH_KEY_RE.test(monthKey)) {
    return { ok: false, error: "เดือนไม่ถูกต้อง" };
  }

  let created = 0;
  try {
    created = await generateRecurringForMonth(user.id, monthKey);
  } catch {
    return { ok: false, error: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง" };
  }

  revalidatePathsForRecurring();
  return { ok: true, created };
}

/** ตั้งค่าใช้จ่ายประจำใหม่ (F6) + สร้างรายการของเดือนนี้ทันทีถ้ายังไม่ถูกข้าม. */
export async function createRecurringRule(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = recurringSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type") ?? "expense",
    categoryId: formData.get("categoryId"),
    amount: formData.get("amount"),
    dayOfMonth: formData.get("dayOfMonth") ?? "",
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง", fieldErrors };
  }
  const data = parsed.data;

  // หมวดต้องเป็นของผู้ใช้ + ประเภทตรงกัน
  const category = await prisma.category.findFirst({
    where: { id: data.categoryId, userId: user.id, kind: data.type },
  });
  if (!category) {
    return { ok: false, error: "กรุณาเลือกหมวดให้ตรงประเภท", fieldErrors: { categoryId: "กรุณาเลือกหมวดให้ตรงประเภท" } };
  }

  const amountSatang = bahtToSatang(data.amount);
  if (!Number.isFinite(amountSatang) || amountSatang <= 0) {
    return { ok: false, error: "ข้อมูลไม่ถูกต้อง" };
  }
  const dayOfMonth = data.dayOfMonth ? Number(data.dayOfMonth) : 1;

  try {
    await prisma.recurringRule.create({
      data: {
        userId: user.id,
        type: data.type,
        categoryId: category.id,
        categoryName: category.name,
        name: data.name,
        amountSatang,
        dayOfMonth,
        active: true,
      },
    });
  } catch {
    return { ok: false, error: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง" };
  }

  // สร้างรายการเดือนนี้ทันที (ให้เห็นผลทันทีตามนิยาม F6)
  await ensureRecurringForCurrentMonth(user.id);

  revalidatePathsForRecurring();
  return { ok: true };
}

/** เปิด/ปิดรายการประจำ (active). ปิด = หยุดสร้างถาวร (ไม่ลบของเก่า). */
export async function toggleRecurringActive(id: string, active: boolean): Promise<ActionResult> {
  const user = await requireUser();
  const rule = await prisma.recurringRule.findFirst({ where: { id, userId: user.id, deletedAt: null } });
  if (!rule) return { ok: false, error: "ไม่พบรายการประจำ" };

  try {
    await prisma.recurringRule.update({ where: { id: rule.id }, data: { active } });
  } catch {
    return { ok: false, error: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง" };
  }

  // เปิดใหม่ตอนกลางเดือน → สร้างรายการเดือนนี้ให้เลย (ถ้ายังไม่ถูกข้าม/ยังไม่มี)
  if (active) await ensureRecurringForCurrentMonth(user.id);

  revalidatePathsForRecurring();
  return { ok: true };
}

/**
 * EDGE-3: ข้ามรายการประจำ "เฉพาะเดือนนี้".
 * - บันทึก RecurringSkip(month=เดือนนี้)
 * - ลบ Entry ที่ระบบสร้างของเดือนนี้ (ถ้ามี) → ยอดเดือนนี้ไม่รวมรายการที่ข้าม
 * - รูปแบบรายการประจำยังอยู่ เดือนถัดไป auto-generate กลับมาปกติ
 */
export async function skipRecurringThisMonth(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const rule = await prisma.recurringRule.findFirst({ where: { id, userId: user.id, deletedAt: null } });
  if (!rule) return { ok: false, error: "ไม่พบรายการประจำ" };

  const month = currentMonthKey();
  const range = bkkMonthRange(month);

  try {
    await prisma.$transaction([
      prisma.recurringSkip.upsert({
        where: { ruleId_month: { ruleId: rule.id, month } },
        create: { ruleId: rule.id, month },
        update: {},
      }),
      // soft-delete รายการที่ระบบสร้างของเดือนนี้ (ข้ามเดือน = ไม่นับรายการนี้; กู้คืนได้เมื่อยกเลิกข้าม)
      prisma.entry.updateMany({
        where: {
          userId: user.id,
          recurringRuleId: rule.id,
          deletedAt: null,
          occurredAt: { gte: range.gte, lt: range.lt },
        },
        data: { deletedAt: new Date() },
      }),
    ]);
  } catch {
    return { ok: false, error: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง" };
  }

  revalidatePathsForRecurring();
  return { ok: true };
}

/** ยกเลิกการข้ามเดือนนี้ (EDGE-3) → ลบ skip + สร้างรายการเดือนนี้กลับมา. */
export async function unskipRecurringThisMonth(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const rule = await prisma.recurringRule.findFirst({ where: { id, userId: user.id, deletedAt: null } });
  if (!rule) return { ok: false, error: "ไม่พบรายการประจำ" };

  const month = currentMonthKey();
  try {
    await prisma.recurringSkip.deleteMany({ where: { ruleId: rule.id, month } });
  } catch {
    return { ok: false, error: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง" };
  }

  await ensureRecurringForCurrentMonth(user.id);
  revalidatePathsForRecurring();
  return { ok: true };
}

/**
 * ลบรูปแบบรายการประจำถาวร. รายการที่เคยถูกสร้างไว้ยังอยู่ (recurringRuleId → null อัตโนมัติ).
 */
export async function deleteRecurringRule(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const rule = await prisma.recurringRule.findFirst({ where: { id, userId: user.id, deletedAt: null } });
  if (!rule) return { ok: false, error: "ไม่พบรายการประจำ" };

  try {
    // soft-delete: ทำเครื่องหมายลบ ไม่ลบจริง — รายการที่เคยสร้างยังอยู่, รูปแบบหยุดสร้าง+ไม่แสดง
    await prisma.recurringRule.update({ where: { id: rule.id }, data: { deletedAt: new Date() } });
  } catch {
    return { ok: false, error: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง" };
  }

  revalidatePathsForRecurring();
  return { ok: true };
}

function revalidatePathsForRecurring() {
  revalidatePath("/recurring");
  revalidatePath("/");
  revalidatePath("/entries");
  revalidatePath("/budgets");
  revalidatePath("/profit");
}
