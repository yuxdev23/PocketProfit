"use server";

/** สินค้า + ต้นทุน/ราคาขาย -> margin% (F5, DoD-5). */

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { productSchema } from "@/lib/validation";
import { bahtToSatang } from "@/lib/money";
import type { ActionResult } from "@/lib/actions/types";

function parse(formData: FormData) {
  return productSchema.safeParse({
    name: formData.get("name"),
    cost: formData.get("cost"),
    price: formData.get("price"),
    lowMarginThreshold: formData.get("lowMarginThreshold") ?? "",
  });
}

function toData(d: { name: string; cost: string; price: string; lowMarginThreshold?: string }) {
  return {
    name: d.name,
    costSatang: bahtToSatang(d.cost),
    priceSatang: bahtToSatang(d.price),
    lowMarginThresholdPct: d.lowMarginThreshold ? Number(d.lowMarginThreshold) : 20,
  };
}

export async function createProduct(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = parse(formData);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) {
      const k = i.path[0];
      if (typeof k === "string" && !fieldErrors[k]) fieldErrors[k] = i.message;
    }
    return { ok: false, error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง", fieldErrors };
  }
  try {
    await prisma.product.create({ data: { userId: user.id, ...toData(parsed.data) } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      // ชนชื่อกับสินค้าที่ถูก soft-delete (archived) ไว้ → กู้คืน + อัปเดตค่าใหม่ แทนการขึ้น error
      const archived = await prisma.product.findFirst({
        where: { userId: user.id, name: parsed.data.name, archived: true },
      });
      if (archived) {
        await prisma.product.update({
          where: { id: archived.id },
          data: { ...toData(parsed.data), archived: false },
        });
        revalidatePath("/products");
        return { ok: true };
      }
      return { ok: false, error: "มีสินค้าชื่อนี้อยู่แล้ว", fieldErrors: { name: "มีสินค้าชื่อนี้อยู่แล้ว" } };
    }
    return { ok: false, error: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง" };
  }
  revalidatePath("/products");
  return { ok: true };
}

export async function updateProduct(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const parsed = parse(formData);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) {
      const k = i.path[0];
      if (typeof k === "string" && !fieldErrors[k]) fieldErrors[k] = i.message;
    }
    return { ok: false, error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง", fieldErrors };
  }
  const existing = await prisma.product.findFirst({ where: { id, userId: user.id } });
  if (!existing) return { ok: false, error: "ไม่พบสินค้า" };
  try {
    await prisma.product.update({ where: { id }, data: toData(parsed.data) });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "มีสินค้าชื่อนี้อยู่แล้ว", fieldErrors: { name: "มีสินค้าชื่อนี้อยู่แล้ว" } };
    }
    return { ok: false, error: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง" };
  }
  revalidatePath("/products");
  return { ok: true };
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const existing = await prisma.product.findFirst({ where: { id, userId: user.id, archived: false } });
  if (!existing) return { ok: false, error: "ไม่พบสินค้า" };
  try {
    // soft-delete: archive ไว้ ไม่ลบจริง (ไม่แสดง/ไม่นำมาคำนวณ; กู้คืนได้เมื่อเพิ่มชื่อเดิมใหม่)
    await prisma.product.update({ where: { id }, data: { archived: true } });
  } catch {
    return { ok: false, error: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง" };
  }
  revalidatePath("/products");
  return { ok: true };
}
