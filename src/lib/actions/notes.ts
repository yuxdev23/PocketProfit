"use server";

/**
 * โน้ต/บันทึกย่อ (feature note) — บันทึก "1 โน้ตต่อขอบเขต":
 *  - global (รวม)      → scopeKey = ""
 *  - daily (รายวัน)    → scopeKey = "YYYY-MM-DD" (เวลาไทย)
 *  - monthly (รายเดือน) → scopeKey = "YYYY-MM" (เวลาไทย)
 * โน้ตว่าง (มีแต่ช่องว่าง) = ลบทิ้ง ไม่เก็บแถวว่าง. คีย์ผูก userId เสมอ (AUTH).
 */

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { noteSchema } from "@/lib/validation";
import type { ActionResult } from "@/lib/actions/types";

const SCOPES = new Set(["global", "daily", "monthly"]);

/** ตรวจ/normalize scopeKey ตาม scope. คืน null ถ้ารูปแบบคีย์ไม่ถูกต้อง. */
function normalizeKey(scope: string, rawKey: string): string | null {
  if (scope === "global") return "";
  if (scope === "daily") return /^\d{4}-\d{2}-\d{2}$/.test(rawKey) ? rawKey : null;
  if (scope === "monthly") return /^\d{4}-\d{2}$/.test(rawKey) ? rawKey : null;
  return null;
}

export async function saveNote(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();

  const scope = String(formData.get("scope") ?? "");
  if (!SCOPES.has(scope)) return { ok: false, error: "ขอบเขตโน้ตไม่ถูกต้อง" };

  const scopeKey = normalizeKey(scope, String(formData.get("scopeKey") ?? ""));
  if (scopeKey === null) return { ok: false, error: "ช่วงวัน/เดือนของโน้ตไม่ถูกต้อง" };

  const parsed = noteSchema.safeParse({ body: String(formData.get("body") ?? "") });
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง";
    return { ok: false, error: msg, fieldErrors: { body: msg } };
  }

  const body = parsed.data.body;
  try {
    if (body.trim().length === 0) {
      // โน้ตว่าง = soft-delete (idempotent — ไม่ throw ถ้ายังไม่เคยมี)
      await prisma.note.updateMany({
        where: { userId: user.id, scope, scopeKey },
        data: { deletedAt: new Date() },
      });
    } else {
      await prisma.note.upsert({
        where: { userId_scope_scopeKey: { userId: user.id, scope, scopeKey } },
        create: { userId: user.id, scope, scopeKey, body },
        update: { body, deletedAt: null }, // เขียนทับ = กู้คืนจาก soft-delete อัตโนมัติ
      });
    }
  } catch {
    return { ok: false, error: "บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" };
  }

  revalidatePath("/notes");
  return { ok: true };
}
