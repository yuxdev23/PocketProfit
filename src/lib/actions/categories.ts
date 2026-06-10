"use server";

/** จัดการหมวดหมู่แบบกำหนดเอง (N2): เพิ่ม/แก้ชื่อ/ลบ. */

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { categorySchema } from "@/lib/validation";
import { currentMonthKey, bkkMonthRange } from "@/lib/dates";
import type { ActionResult } from "@/lib/actions/types";

export async function createCategory(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    kind: formData.get("kind"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) {
      const k = i.path[0];
      if (typeof k === "string" && !fieldErrors[k]) fieldErrors[k] = i.message;
    }
    return { ok: false, error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง", fieldErrors };
  }
  try {
    await prisma.category.create({
      data: { userId: user.id, name: parsed.data.name, kind: parsed.data.kind },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      // ชนชื่อ+ประเภทกับหมวดที่ถูก soft-delete (archived) ไว้ → กู้คืน แทนการขึ้น error
      const archived = await prisma.category.findFirst({
        where: { userId: user.id, name: parsed.data.name, kind: parsed.data.kind, archived: true },
      });
      if (archived) {
        await prisma.category.update({ where: { id: archived.id }, data: { archived: false } });
        revalidatePath("/categories");
        revalidatePath("/budgets");
        return { ok: true };
      }
      return { ok: false, error: "มีหมวดนี้อยู่แล้ว", fieldErrors: { name: "มีหมวดนี้อยู่แล้ว" } };
    }
    return { ok: false, error: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง" };
  }
  revalidatePath("/categories");
  revalidatePath("/budgets");
  return { ok: true };
}

/** แก้ชื่อหมวด — ปรับ snapshot categoryName ใน entries ที่อ้างถึงด้วย (กันชื่อค้าง). */
export async function renameCategory(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 1) {
    return { ok: false, error: "กรุณากรอกชื่อ", fieldErrors: { name: "กรุณากรอกชื่อ" } };
  }
  if (name.length > 40) {
    return { ok: false, error: "ชื่อยาวเกินไป", fieldErrors: { name: "ชื่อยาวเกินไป" } };
  }
  const existing = await prisma.category.findFirst({ where: { id, userId: user.id } });
  if (!existing) return { ok: false, error: "ไม่พบหมวด" };
  try {
    // เขียน snapshot ชื่อใหม่เฉพาะรายการ "เดือนปัจจุบันเป็นต้นไป" — รายการเดือนย้อนหลังคงชื่อ
    // ณ ตอนบันทึก เพื่อให้สรุปย้อนหลังของแต่ละเดือนไม่เปลี่ยนตามการแก้ชื่อหมวด (เก็บข้อมูลแยกต่อเดือน)
    const curMonthStart = bkkMonthRange(currentMonthKey()).gte;
    await prisma.$transaction([
      prisma.category.update({ where: { id }, data: { name } }),
      prisma.entry.updateMany({
        where: { userId: user.id, categoryId: id, occurredAt: { gte: curMonthStart } },
        data: { categoryName: name },
      }),
    ]);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "มีหมวดนี้อยู่แล้ว", fieldErrors: { name: "มีหมวดนี้อยู่แล้ว" } };
    }
    return { ok: false, error: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง" };
  }
  revalidatePath("/categories");
  revalidatePath("/budgets");
  revalidatePath("/entries");
  return { ok: true };
}

/**
 * ลบหมวด. ถ้ามีรายการอ้างอยู่ -> archive แทน (กันข้อมูลยอดหาย) แต่ entries ยังคง
 * categoryName snapshot ไว้แสดง. ถ้าไม่มีรายการ -> ลบจริง.
 */
export async function deleteCategory(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const existing = await prisma.category.findFirst({ where: { id, userId: user.id, archived: false } });
  if (!existing) return { ok: false, error: "ไม่พบหมวด" };

  try {
    // soft-delete: archive เสมอ ไม่ลบจริง — entries เก็บ snapshot categoryName ไว้แสดง
    // และยอดของหมวดที่ลบจะไม่ถูกนำมาคำนวณ/แสดง (queries กรอง archived/deletedAt).
    await prisma.category.update({ where: { id }, data: { archived: true } });
  } catch {
    return { ok: false, error: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง" };
  }
  revalidatePath("/categories");
  revalidatePath("/budgets");
  return { ok: true };
}
