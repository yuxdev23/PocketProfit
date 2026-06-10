"use server";

/**
 * Server actions สำหรับรายการรายรับ/รายจ่าย (F1, DoD-1, F7, EDGE-1/2/4, N3).
 * ทุก action: requireUser() + re-validate ด้วย zod + ผูก userId เสมอ (ไม่เชื่อ client).
 * ไม่ปล่อย raw error ออกไป client — คืน { ok:false, error } เป็นข้อความไทย.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { entrySchema, editEntrySchema } from "@/lib/validation";
import { bahtToSatang, formatBaht } from "@/lib/money";
import { bkkDateKeyToInstant, bkkDayRange } from "@/lib/dates";
import { saveReceipts } from "@/lib/actions/upload";
import { parseReceiptPaths, serializeReceiptPaths } from "@/lib/receipts";
import { categoryAverageSatang } from "@/lib/queries";
import type { ActionResult, RevisionView } from "@/lib/actions/types";

const VAT_RATE = 7;

/**
 * เหตุผลที่ต้องให้ผู้ใช้ยืนยันก่อนบันทึก (EDGE-2/EDGE-4).
 * ต่างจาก ActionResult เดิมตรงที่ "รวมหลายเหตุผลไว้ด้วยกัน" (ซ้ำ + สูงผิดปกติ)
 * เพื่อให้ฝั่ง client โชว์ครบในกล่องยืนยันเดียว ไม่ถามทีละข้อ.
 */
export type ConfirmReason = { kind: "duplicate" | "unusual"; message: string };

/** ผลลัพธ์ของ createEntry — superset ของ ActionResult (เพิ่ม needConfirm แบบหลายเหตุผล). */
export type CreateEntryResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> }
  | { ok: false; needConfirm: { title: string; reasons: ConfirmReason[] } };

/** VAT inclusive: ยอดที่กรอกรวม VAT แล้ว -> ส่วนที่เป็นภาษี (สตางค์) */
function vatPortion(totalSatang: number, ratePct: number): number {
  if (ratePct <= 0) return 0;
  return Math.round(totalSatang - totalSatang / (1 + ratePct / 100));
}

function firstError(err: z.ZodError): { error: string; fieldErrors: Record<string, string> } {
  const fieldErrors: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return { error: err.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง", fieldErrors };
}

/** ดึง parsed payload จาก FormData (ใช้ทั้ง create และ edit). */
function readEntryForm(formData: FormData) {
  return {
    type: formData.get("type"),
    amount: formData.get("amount"),
    categoryId: formData.get("categoryId"),
    date: formData.get("date"),
    note: formData.get("note") ?? "",
    vat7: formData.get("vat7") === "on" || formData.get("vat7") === "true",
  };
}

/**
 * สร้างรายการใหม่ (F1, DoD-1).
 * confirm = comma-separated เหตุผลที่ผู้ใช้ "ยืนยันแล้ว" (เช่น "duplicate,unusual")
 * -> ข้ามการเตือนที่ยืนยันไปแล้ว. EDGE-2 + EDGE-4 ถูกตรวจพร้อมกันแล้วรวมเป็นชุดเดียว.
 */
export async function createEntry(formData: FormData): Promise<CreateEntryResult> {
  const user = await requireUser();

  const parsed = entrySchema.safeParse(readEntryForm(formData));
  if (!parsed.success) {
    const { error, fieldErrors } = firstError(parsed.error);
    return { ok: false, error, fieldErrors };
  }
  const data = parsed.data;
  // ผู้ใช้อาจยืนยันหลายเหตุผลพร้อมกัน — รับเป็นชุด (set) ของ kind ที่ยืนยันแล้ว
  const confirmed = new Set(
    String(formData.get("confirm") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );

  // หมวดต้องเป็นของผู้ใช้ + ประเภทตรงกัน
  const category = await prisma.category.findFirst({
    where: { id: data.categoryId, userId: user.id, kind: data.type },
  });
  if (!category) {
    return { ok: false, error: "กรุณาเลือกหมวดก่อนบันทึก", fieldErrors: { categoryId: "กรุณาเลือกหมวดก่อนบันทึก" } };
  }

  const amountSatang = bahtToSatang(data.amount);
  const occurredAt = bkkDateKeyToInstant(data.date);
  if (!occurredAt || !Number.isFinite(amountSatang) || amountSatang <= 0) {
    return { ok: false, error: "ข้อมูลไม่ถูกต้อง" };
  }

  // รวบรวมเหตุผลที่ต้องให้ยืนยัน (ซ้ำ + สูงผิดปกติ) แล้วถามครั้งเดียวพร้อมกัน
  const reasons: ConfirmReason[] = [];

  // EDGE-2: ตรวจรายการซ้ำ (วันที่+จำนวน+หมวด เดียวกัน)
  if (!confirmed.has("duplicate")) {
    const day = bkkDayRange(data.date);
    const dup = await prisma.entry.findFirst({
      where: {
        userId: user.id,
        deletedAt: null,
        categoryId: data.categoryId,
        amountSatang,
        occurredAt: { gte: day.gte, lt: day.lt },
      },
    });
    if (dup) {
      reasons.push({
        kind: "duplicate",
        message: `มีรายการ ${category.name} ${data.amount} บาท ในวันเดียวกันอยู่แล้ว ต้องการบันทึกซ้ำหรือไม่?`,
      });
    }
  }

  // EDGE-4: ยอดสูงผิดปกติ (≥ ~4× ค่าเฉลี่ยหมวด)
  if (!confirmed.has("unusual")) {
    const avg = await categoryAverageSatang(user.id, data.categoryId);
    if (avg && avg > 0 && amountSatang >= avg * 4) {
      reasons.push({
        kind: "unusual",
        message: `ยอดนี้ (${data.amount} บาท) สูงกว่าค่าเฉลี่ยหมวด ${category.name} (~${formatBaht(avg)} บาท) หลายเท่า ตรวจสอบตัวเลขอีกครั้งหรือไม่?`,
      });
    }
  }

  // มีอย่างน้อยหนึ่งเหตุผล -> ส่งกลับทั้งชุดให้ผู้ใช้ยืนยันในกล่องเดียว
  if (reasons.length > 0) {
    return {
      ok: false,
      needConfirm: { title: "ขอเช็กอีกนิดก่อนบันทึก", reasons },
    };
  }

  // แนบรูป (ถ้ามี) — DoD-1 · รองรับหลายไฟล์
  let receiptPaths: string | null = null;
  const files = formData
    .getAll("receipt")
    .filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length) {
    const res = await saveReceipts(files, user.id);
    if (!res.ok) return { ok: false, error: res.error, fieldErrors: { receipt: res.error } };
    receiptPaths = serializeReceiptPaths(res.paths);
  }

  const vatRate = data.vat7 ? VAT_RATE : 0;

  try {
    await prisma.entry.create({
      data: {
        userId: user.id,
        type: data.type,
        categoryId: category.id,
        categoryName: category.name,
        amountSatang,
        occurredAt,
        note: data.note || null,
        receiptPaths,
        vatRate,
        vatAmountSatang: vatPortion(amountSatang, vatRate),
      },
    });
  } catch {
    return { ok: false, error: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง" };
  }

  revalidatePath("/");
  revalidatePath("/entries");
  revalidatePath("/budgets");
  revalidatePath("/profit");
  revalidatePath("/goals");
  return { ok: true };
}

/**
 * แก้รายการย้อนหลัง (EDGE-1, F7) — บังคับเหตุผล + เก็บประวัติ field ที่เปลี่ยน.
 */
export async function updateEntry(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const entryId = String(formData.get("entryId") ?? "");
  if (!entryId) return { ok: false, error: "ไม่พบรายการ" };

  const parsed = editEntrySchema.safeParse({
    ...readEntryForm(formData),
    reason: formData.get("reason") ?? "",
  });
  if (!parsed.success) {
    const { error, fieldErrors } = firstError(parsed.error);
    return { ok: false, error, fieldErrors };
  }
  const data = parsed.data;

  const existing = await prisma.entry.findFirst({ where: { id: entryId, userId: user.id, deletedAt: null } });
  if (!existing) return { ok: false, error: "ไม่พบรายการ" };

  const category = await prisma.category.findFirst({
    where: { id: data.categoryId, userId: user.id, kind: data.type },
  });
  if (!category) {
    return { ok: false, error: "กรุณาเลือกหมวดก่อนบันทึก", fieldErrors: { categoryId: "กรุณาเลือกหมวดก่อนบันทึก" } };
  }

  const amountSatang = bahtToSatang(data.amount);
  const occurredAt = bkkDateKeyToInstant(data.date);
  if (!occurredAt || !Number.isFinite(amountSatang) || amountSatang <= 0) {
    return { ok: false, error: "ข้อมูลไม่ถูกต้อง" };
  }

  // รูปที่แนบ (F7): รูปเดิมที่ "เก็บไว้" + รูปใหม่ที่อัปโหลด · รองรับหลายไฟล์
  const existingPaths = parseReceiptPaths(existing.receiptPaths);
  // keepReceipts = path เดิมที่ผู้ใช้ไม่ได้ลบ — กรองให้เหลือเฉพาะรูปที่เป็นของรายการนี้จริง (กันยัด path มั่ว)
  const kept = parseReceiptPaths(String(formData.get("keepReceipts") ?? "")).filter((p) =>
    existingPaths.includes(p),
  );
  const files = formData
    .getAll("receipt")
    .filter((f): f is File => f instanceof File && f.size > 0);
  let newPaths: string[] = [];
  if (files.length) {
    const res = await saveReceipts(files, user.id);
    if (!res.ok) return { ok: false, error: res.error, fieldErrors: { receipt: res.error } };
    newPaths = res.paths;
  }
  const receiptPaths = serializeReceiptPaths([...kept, ...newPaths]);

  const vatRate = data.vat7 ? VAT_RATE : 0;
  const newNote = data.note || null;

  // เก็บ diff ของ field ที่เปลี่ยน (audit) — EDGE-1
  const reason = data.reason;
  const revisions: { field: string; oldValue: string; newValue: string }[] = [];
  if (existing.amountSatang !== amountSatang)
    revisions.push({ field: "amountSatang", oldValue: String(existing.amountSatang), newValue: String(amountSatang) });
  if (existing.type !== data.type)
    revisions.push({ field: "type", oldValue: existing.type, newValue: data.type });
  if (existing.categoryName !== category.name)
    revisions.push({ field: "categoryName", oldValue: existing.categoryName, newValue: category.name });
  if (existing.occurredAt.getTime() !== occurredAt.getTime())
    revisions.push({ field: "occurredAt", oldValue: existing.occurredAt.toISOString(), newValue: occurredAt.toISOString() });
  if ((existing.note ?? "") !== (newNote ?? ""))
    revisions.push({ field: "note", oldValue: existing.note ?? "", newValue: newNote ?? "" });
  if (existing.vatRate !== vatRate)
    revisions.push({ field: "vatRate", oldValue: String(existing.vatRate), newValue: String(vatRate) });

  try {
    await prisma.$transaction([
      prisma.entry.update({
        where: { id: entryId },
        data: {
          type: data.type,
          categoryId: category.id,
          categoryName: category.name,
          amountSatang,
          occurredAt,
          note: newNote,
          receiptPaths,
          vatRate,
          vatAmountSatang: vatPortion(amountSatang, vatRate),
        },
      }),
      ...revisions.map((r) =>
        prisma.entryRevision.create({
          data: { entryId, userId: user.id, field: r.field, oldValue: r.oldValue, newValue: r.newValue, reason },
        }),
      ),
    ]);
  } catch {
    return { ok: false, error: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง" };
  }

  revalidatePath("/");
  revalidatePath("/entries");
  revalidatePath("/budgets");
  revalidatePath("/profit");
  return { ok: true };
}

/** ดึงประวัติการแก้ไขของรายการ (F7) — ผูก userId กัน IDOR. */
export async function fetchRevisions(
  entryId: string,
): Promise<{ ok: true; revisions: RevisionView[] } | { ok: false; error: string }> {
  const user = await requireUser();
  const entry = await prisma.entry.findFirst({ where: { id: entryId, userId: user.id, deletedAt: null } });
  if (!entry) return { ok: false, error: "ไม่พบรายการ" };
  const rows = await prisma.entryRevision.findMany({
    where: { entryId, userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  return {
    ok: true,
    revisions: rows.map((r) => ({
      id: r.id,
      field: r.field,
      oldValue: r.oldValue,
      newValue: r.newValue,
      reason: r.reason,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

/** ลบรายการ — ผูก userId กัน IDOR. */
export async function deleteEntry(entryId: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!entryId) return { ok: false, error: "ไม่พบรายการ" };
  const existing = await prisma.entry.findFirst({ where: { id: entryId, userId: user.id, deletedAt: null } });
  if (!existing) return { ok: false, error: "ไม่พบรายการ" };

  try {
    // soft-delete: ทำเครื่องหมายว่าลบ ไม่ลบจริง (กู้คืน/ตรวจสอบย้อนหลังได้ และไม่ถูกนำมาคำนวณ)
    await prisma.entry.update({ where: { id: entryId }, data: { deletedAt: new Date() } });
  } catch {
    return { ok: false, error: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง" };
  }

  revalidatePath("/");
  revalidatePath("/entries");
  revalidatePath("/budgets");
  revalidatePath("/profit");
  return { ok: true };
}
