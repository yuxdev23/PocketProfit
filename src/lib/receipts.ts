/**
 * รูปสลิป/ใบเสร็จของรายการ (F7) — เก็บได้หลายรูป เป็น JSON array ของ path
 * ในคอลัมน์เดียว `Entry.receiptPaths` เช่น `["/uploads/u/a.png","/uploads/u/b.jpg"]`.
 * helper นี้ใช้ได้ทั้งฝั่ง client และ server (ไม่มี "server-only").
 */

/** อ่านค่า receiptPaths (JSON) → string[] เสมอ (กันพังถ้าค่าเพี้ยน/เป็น path เดี่ยวแบบเก่า) */
export function parseReceiptPaths(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const arr = JSON.parse(value);
    if (Array.isArray(arr)) {
      return arr.filter((x): x is string => typeof x === "string" && x.length > 0);
    }
  } catch {
    // เผื่อค่าเก่าที่เคยเก็บเป็น path เดี่ยว (ไม่ใช่ JSON) — ไม่ให้พัง
    if (value.startsWith("/")) return [value];
  }
  return [];
}

/** แปลง string[] → ค่าที่จะเก็บลงคอลัมน์ (null ถ้าไม่มีรูป) */
export function serializeReceiptPaths(paths: string[]): string | null {
  return paths.length ? JSON.stringify(paths) : null;
}
