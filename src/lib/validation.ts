/**
 * Zod schemas — ใช้ "ตัวเดียวกันทั้ง client (react-hook-form) และ server (re-validate)".
 * ข้อความ error = ภาษาไทยเป๊ะตาม docs/ui/design.md §4 (จุดเก็บแต้ม Output Quality 20%).
 *
 * หลักการเงิน: ฟอร์มรับ "บาท" เป็น string (จากช่อง input) แล้ว validate ละเอียด
 * (ว่าง / ไม่ใช่เลข / ≤0 / ทศนิยม>2 / >10,000,000) ก่อนแปลงเป็นสตางค์.
 */

import { z } from "zod";
import { todayDateKey } from "@/lib/dates";

export const MAX_BAHT = 10_000_000;

/**
 * ตัวตรวจ "จำนวนเงิน (บาท)" จาก string ของ input. คืน schema ที่ refine ตามลำดับข้อความ
 * ใน design §4 A. ผลลัพธ์ผ่านแล้วเป็น string ที่แปลงเป็น number ได้.
 */
export const bahtAmountString = z
  .string({ required_error: "กรุณากรอกจำนวนเงิน" })
  .trim()
  .min(1, "กรุณากรอกจำนวนเงิน")
  // ต้องเป็นรูปแบบตัวเลข (อนุญาตจุดทศนิยม) เท่านั้น — กันตัวอักษร
  .refine((v) => /^\d+(\.\d+)?$/.test(v), "กรอกเป็นตัวเลขเท่านั้น")
  // > 0
  .refine((v) => Number(v) > 0, "จำนวนเงินต้องมากกว่า 0 บาท")
  // ทศนิยมไม่เกิน 2 ตำแหน่ง
  .refine((v) => {
    const dot = v.indexOf(".");
    return dot === -1 || v.length - dot - 1 <= 2;
  }, "จำนวนเงินใส่ทศนิยมได้ไม่เกิน 2 ตำแหน่ง")
  // เพดาน
  .refine((v) => Number(v) <= MAX_BAHT, "จำนวนเงินสูงเกินไป กรุณาตรวจสอบอีกครั้ง");

/** วันที่ "YYYY-MM-DD": ต้องถูกรูปแบบ และไม่ใช่อนาคต (เวลาไทย). */
export const dateKeyString = z
  .string({ required_error: "กรุณาเลือกวันที่ให้ถูกต้อง" })
  .trim()
  .min(1, "กรุณาเลือกวันที่ให้ถูกต้อง")
  .refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v), "กรุณาเลือกวันที่ให้ถูกต้อง")
  .refine((v) => v <= todayDateKey(), "เลือกวันที่ในอนาคตไม่ได้");

/** ฟอร์มบันทึก/แก้รายการ (F1, DoD-1, N3). amount/date เป็น string จาก input. */
export const entrySchema = z.object({
  type: z.enum(["income", "expense"], {
    required_error: "กรุณาเลือกประเภทรายรับหรือรายจ่าย",
    invalid_type_error: "กรุณาเลือกประเภทรายรับหรือรายจ่าย",
  }),
  amount: bahtAmountString,
  categoryId: z
    .string({ required_error: "กรุณาเลือกหมวดก่อนบันทึก" })
    .trim()
    .min(1, "กรุณาเลือกหมวดก่อนบันทึก"),
  date: dateKeyString,
  note: z.string().trim().max(200, "หมายเหตุยาวเกินไป").optional().or(z.literal("")),
  vat7: z.boolean().optional().default(false),
});
export type EntryInput = z.infer<typeof entrySchema>;

/** เหตุผลการแก้ไข (EDGE-1, F7) — บังคับ ≥ 3 ตัวอักษร. */
export const editReasonSchema = z
  .string({ required_error: "กรุณาระบุเหตุผลในการแก้ไข" })
  .trim()
  .min(1, "กรุณาระบุเหตุผลในการแก้ไข")
  .min(3, "ระบุเหตุผลอย่างน้อย 3 ตัวอักษร");

/** ฟอร์มแก้รายการ = entry fields + เหตุผล (EDGE-1). */
export const editEntrySchema = entrySchema.extend({
  reason: editReasonSchema,
});
export type EditEntryInput = z.infer<typeof editEntrySchema>;

/** ตั้งงบหมวด (F2). */
export const budgetSchema = z.object({
  categoryId: z.string().trim().min(1, "กรุณาเลือกหมวด"),
  budget: z
    .string()
    .trim()
    .min(1, "กรุณากรอกงบประมาณมากกว่า 0 บาท")
    .refine((v) => /^\d+(\.\d+)?$/.test(v), "กรอกเป็นตัวเลขเท่านั้น")
    .refine((v) => Number(v) > 0, "กรุณากรอกงบประมาณมากกว่า 0 บาท")
    .refine((v) => Number(v) <= MAX_BAHT, "จำนวนเงินสูงเกินไป กรุณาตรวจสอบอีกครั้ง"),
});

/** ตั้งเป้าเดือน (F4, DoD-4): เป้ารายได้ + เพดานรายจ่าย. */
export const goalSchema = z.object({
  incomeTarget: z
    .string()
    .trim()
    .min(1, "กรุณากรอกเป้ารายได้มากกว่า 0 บาท")
    .refine((v) => /^\d+(\.\d+)?$/.test(v), "กรอกเป็นตัวเลขเท่านั้น")
    .refine((v) => Number(v) > 0, "กรุณากรอกเป้ารายได้มากกว่า 0 บาท")
    .refine((v) => Number(v) <= MAX_BAHT, "จำนวนเงินสูงเกินไป กรุณาตรวจสอบอีกครั้ง"),
  expenseTarget: z
    .string()
    .trim()
    .min(1, "กรุณากรอกเพดานรายจ่ายมากกว่า 0 บาท")
    .refine((v) => /^\d+(\.\d+)?$/.test(v), "กรอกเป็นตัวเลขเท่านั้น")
    .refine((v) => Number(v) > 0, "กรุณากรอกเพดานรายจ่ายมากกว่า 0 บาท")
    .refine((v) => Number(v) <= MAX_BAHT, "จำนวนเงินสูงเกินไป กรุณาตรวจสอบอีกครั้ง"),
});
export type GoalInput = z.infer<typeof goalSchema>;

/** สินค้า + ต้นทุน/ราคา (F5, DoD-5). */
export const productSchema = z.object({
  name: z.string().trim().min(1, "กรุณากรอกชื่อ").max(60, "ชื่อยาวเกินไป"),
  cost: z
    .string()
    .trim()
    .min(1, "กรุณากรอกต้นทุนให้ถูกต้อง")
    .refine((v) => /^\d+(\.\d+)?$/.test(v), "กรุณากรอกต้นทุนให้ถูกต้อง")
    .refine((v) => Number(v) >= 0, "กรุณากรอกต้นทุนให้ถูกต้อง")
    .refine((v) => Number(v) <= MAX_BAHT, "จำนวนเงินสูงเกินไป กรุณาตรวจสอบอีกครั้ง"),
  price: z
    .string()
    .trim()
    .min(1, "ราคาขายต้องมากกว่า 0 บาท")
    .refine((v) => /^\d+(\.\d+)?$/.test(v), "กรอกเป็นตัวเลขเท่านั้น")
    .refine((v) => Number(v) > 0, "ราคาขายต้องมากกว่า 0 บาท")
    .refine((v) => Number(v) <= MAX_BAHT, "จำนวนเงินสูงเกินไป กรุณาตรวจสอบอีกครั้ง"),
  lowMarginThreshold: z
    .string()
    .trim()
    .optional()
    .refine(
      (v) => !v || (/^\d+$/.test(v) && Number(v) >= 0 && Number(v) <= 100),
      "เกณฑ์ margin ต้องเป็น 0–100",
    ),
});
export type ProductInput = z.infer<typeof productSchema>;

/** หมวดหมู่ (N2). */
export const categorySchema = z.object({
  name: z.string().trim().min(1, "กรุณากรอกชื่อ").max(40, "ชื่อยาวเกินไป"),
  kind: z.enum(["income", "expense"], {
    required_error: "กรุณาเลือกประเภท",
    invalid_type_error: "กรุณาเลือกประเภท",
  }),
});
export type CategoryInput = z.infer<typeof categorySchema>;

/** ค่าใช้จ่ายประจำ (F6). */
export const recurringSchema = z.object({
  name: z.string().trim().min(1, "กรุณากรอกชื่อ").max(60, "ชื่อยาวเกินไป"),
  type: z.enum(["income", "expense"]).default("expense"),
  categoryId: z.string().trim().min(1, "กรุณาเลือกหมวด"),
  amount: z
    .string()
    .trim()
    .min(1, "กรุณากรอกจำนวนเงินมากกว่า 0 บาท")
    .refine((v) => /^\d+(\.\d+)?$/.test(v), "กรอกเป็นตัวเลขเท่านั้น")
    .refine((v) => Number(v) > 0, "กรุณากรอกจำนวนเงินมากกว่า 0 บาท")
    .refine((v) => Number(v) <= MAX_BAHT, "จำนวนเงินสูงเกินไป กรุณาตรวจสอบอีกครั้ง"),
  dayOfMonth: z
    .string()
    .trim()
    .optional()
    .refine(
      (v) => !v || (/^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 28),
      "วันที่ของเดือนต้องเป็น 1–28",
    ),
});
export type RecurringInput = z.infer<typeof recurringSchema>;

/**
 * โน้ต/บันทึกย่อ (feature note). body ปล่อยว่างได้ (= ลบโน้ตทิ้ง) จึงไม่มี min;
 * จำกัดความยาวกัน payload บวม + ข้อความ error ไทยชัดเจน (Output Quality).
 * ไม่ trim เพื่อคงการขึ้นบรรทัด/ย่อหน้าที่ผู้ใช้ตั้งใจ (ฝั่ง action ตัดสิน "ว่าง" ด้วย trim).
 */
export const NOTE_MAX = 2000;
export const noteScopes = ["global", "daily", "monthly"] as const;
export const noteSchema = z.object({
  body: z
    .string()
    .max(NOTE_MAX, `โน้ตยาวเกินไป (สูงสุด ${NOTE_MAX.toLocaleString("th-TH")} ตัวอักษร)`),
});
export type NoteInput = z.infer<typeof noteSchema>;
