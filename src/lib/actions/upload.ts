import "server-only";

/**
 * บันทึกรูปสลิป/ใบเสร็จที่แนบ (DoD-1, F7).
 * เก็บลง <root>/uploads/<userId>/<random>.<ext> — อยู่ "นอก" public/ จึงไม่ถูกเสิร์ฟเป็น static
 * (เข้าถึงผ่าน route /uploads/[...] ที่ตรวจสิทธิ์เจ้าของก่อนเสมอ → กันรูปการเงินรั่วสู่สาธารณะ).
 * Validate: รับเฉพาะรูป raster ที่อนุญาต (ไม่รับ SVG เพราะฝัง script ได้ = ช่อง XSS) + ไม่เกิน 5 MB.
 */

import { randomBytes } from "crypto";
import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";

/** โฟลเดอร์เก็บไฟล์แนบ — นอก public/ (ไม่เสิร์ฟ static). route handler อ่านจากที่นี่. */
export const UPLOAD_DIR = path.join(process.cwd(), "uploads");

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

/** ชนิดไฟล์ที่อนุญาต → นามสกุล. เฉพาะรูป raster (ตัด SVG ออกเพราะเป็นช่อง XSS). */
const ALLOWED = new Map<string, string>([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
  ["image/heic", "heic"],
  ["image/heif", "heif"],
]);

export type SaveReceiptResult = { ok: true; path: string } | { ok: false; error: string };

export async function saveReceipt(file: File, userId: string): Promise<SaveReceiptResult> {
  const ext = ALLOWED.get(file.type);
  if (!ext) {
    return { ok: false, error: "แนบได้เฉพาะไฟล์รูป (JPG / PNG / WebP / GIF / HEIC)" };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "รูปใหญ่เกินไป (ไม่เกิน 5 MB)" };
  }

  const name = `${Date.now()}-${randomBytes(6).toString("hex")}.${ext}`;
  // กัน path traversal: userId มาจาก session (cuid) แต่ sanitize ซ้ำให้ชัวร์
  const safeUser = userId.replace(/[^a-zA-Z0-9_-]/g, "");
  const dir = path.join(UPLOAD_DIR, safeUser);

  try {
    await mkdir(dir, { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(dir, name), buffer);
  } catch {
    return { ok: false, error: "บันทึกรูปไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" };
  }

  return { ok: true, path: `/uploads/${safeUser}/${name}` };
}

export type SaveReceiptsResult =
  | { ok: true; paths: string[] }
  | { ok: false; error: string };

/**
 * บันทึกรูปสลิป/ใบเสร็จหลายไฟล์ (F7) — แต่ละไฟล์ผ่าน saveReceipt (รูป + ≤ 5 MB).
 * ทำแบบ all-or-nothing: ถ้าไฟล์ใดไม่ผ่าน ลบไฟล์ที่เพิ่งเขียนสำเร็จก่อนหน้าทิ้ง (กัน orphan บนดิสก์)
 * แล้วคืน error — รายการจะไม่ถูกสร้าง จึงไม่มี path ค้างใน DB.
 */
export async function saveReceipts(files: File[], userId: string): Promise<SaveReceiptsResult> {
  const paths: string[] = [];
  for (const file of files) {
    const res = await saveReceipt(file, userId);
    if (!res.ok) {
      // rollback: ลบไฟล์ก่อนหน้าที่เขียนสำเร็จแล้ว (path = /uploads/<user>/<name> → ดิสก์ใต้ UPLOAD_DIR)
      await Promise.all(
        paths.map((p) =>
          unlink(path.join(UPLOAD_DIR, p.replace(/^\/uploads\//, ""))).catch(() => {}),
        ),
      );
      return { ok: false, error: res.error };
    }
    paths.push(res.path);
  }
  return { ok: true, paths };
}
