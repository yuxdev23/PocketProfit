"use server";

/** ตั้ง/แก้งบประมาณรายหมวด (F2, DoD-2). */

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { budgetSchema } from "@/lib/validation";
import { bahtToSatang } from "@/lib/money";
import { currentMonthKey } from "@/lib/dates";
import type { ActionResult } from "@/lib/actions/types";

export async function setBudget(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = budgetSchema.safeParse({
    categoryId: formData.get("categoryId"),
    budget: formData.get("budget"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  }

  const cat = await prisma.category.findFirst({
    where: { id: parsed.data.categoryId, userId: user.id },
  });
  if (!cat) return { ok: false, error: "ไม่พบหมวด" };

  // F2.2: ตั้ง/แก้งบได้เฉพาะ "เดือนปัจจุบัน" → upsert งบของเดือนนี้ (เดือนก่อนหน้าไม่ถูกแตะ)
  const month = currentMonthKey();
  try {
    await prisma.categoryBudget.upsert({
      where: { categoryId_month: { categoryId: cat.id, month } },
      update: { amountSatang: bahtToSatang(parsed.data.budget) },
      create: {
        userId: user.id,
        categoryId: cat.id,
        month,
        amountSatang: bahtToSatang(parsed.data.budget),
      },
    });
  } catch {
    return { ok: false, error: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง" };
  }

  revalidatePath("/budgets");
  revalidatePath("/");
  return { ok: true };
}

/** ยกเลิกงบของหมวด "ตั้งแต่เดือนนี้" (tombstone amountSatang=null กัน carry-forward ดึงงบเก่ามาแทน). */
export async function clearBudget(categoryId: string): Promise<ActionResult> {
  const user = await requireUser();
  const cat = await prisma.category.findFirst({ where: { id: categoryId, userId: user.id } });
  if (!cat) return { ok: false, error: "ไม่พบหมวด" };
  const month = currentMonthKey();
  try {
    await prisma.categoryBudget.upsert({
      where: { categoryId_month: { categoryId: cat.id, month } },
      update: { amountSatang: null },
      create: { userId: user.id, categoryId: cat.id, month, amountSatang: null },
    });
  } catch {
    return { ok: false, error: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง" };
  }
  revalidatePath("/budgets");
  return { ok: true };
}
