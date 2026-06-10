"use server";

/** ตั้งเป้ารายได้ + เพดานรายจ่ายต่อเดือน (F4, DoD-4). */

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { goalSchema } from "@/lib/validation";
import { bahtToSatang } from "@/lib/money";
import { currentMonthKey } from "@/lib/dates";
import type { ActionResult } from "@/lib/actions/types";

export async function setGoal(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const monthRaw = String(formData.get("month") ?? "");
  const month = /^\d{4}-\d{2}$/.test(monthRaw) ? monthRaw : currentMonthKey();

  const parsed = goalSchema.safeParse({
    incomeTarget: formData.get("incomeTarget"),
    expenseTarget: formData.get("expenseTarget"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) {
      const k = i.path[0];
      if (typeof k === "string" && !fieldErrors[k]) fieldErrors[k] = i.message;
    }
    return { ok: false, error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง", fieldErrors };
  }

  const incomeTargetSatang = bahtToSatang(parsed.data.incomeTarget);
  const expenseTargetSatang = bahtToSatang(parsed.data.expenseTarget);

  try {
    await prisma.goal.upsert({
      where: { userId_month: { userId: user.id, month } },
      create: { userId: user.id, month, incomeTargetSatang, expenseTargetSatang },
      update: { incomeTargetSatang, expenseTargetSatang },
    });
  } catch {
    return { ok: false, error: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง" };
  }

  revalidatePath("/goals");
  revalidatePath("/");
  return { ok: true };
}
