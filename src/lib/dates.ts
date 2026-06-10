/**
 * Date helpers — ทุกการตัดยอด "วันนี้ / เดือนนี้" อิงเวลาไทย (Asia/Bangkok, UTC+7)
 * ไม่ใช่ UTC หรือเวลาเครื่อง server. กันยอดข้ามวัน/ข้ามเดือนเพี้ยน (proactive edge).
 *
 * วิธีคิด: เราเก็บ occurredAt เป็น Date (UTC instant). ในการจัดกลุ่มตามวัน/เดือน
 * เราแปลง instant -> ส่วนประกอบเวลาไทย โดยบวก offset +7 ชม. แล้วอ่านเป็น UTC.
 */

const BKK_OFFSET_MS = 7 * 60 * 60 * 1000; // +07:00

/** ส่วนประกอบวันที่ตามเวลาไทยของ instant หนึ่ง */
export type BkkParts = { year: number; month: number; day: number };

/** instant -> {year, month(1-12), day} ตามเวลาไทย */
export function bkkParts(instant: Date): BkkParts {
  const shifted = new Date(instant.getTime() + BKK_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

/** "YYYY-MM-DD" (เวลาไทย) ของ instant — ใช้จัดกลุ่มรายวัน */
export function bkkDateKey(instant: Date): string {
  const { year, month, day } = bkkParts(instant);
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** "YYYY-MM" (เวลาไทย) ของ instant — ใช้จัดกลุ่มรายเดือน / Goal.month / Skip.month */
export function bkkMonthKey(instant: Date): string {
  const { year, month } = bkkParts(instant);
  return `${year}-${pad(month)}`;
}

/** "วันนี้" ตามเวลาไทย ณ ตอนนี้ */
export function todayBkk(): BkkParts {
  return bkkParts(new Date());
}

/** "YYYY-MM" ของเดือนปัจจุบัน (เวลาไทย) */
export function currentMonthKey(): string {
  return bkkMonthKey(new Date());
}

/** "YYYY-MM-DD" ของวันนี้ (เวลาไทย) — ใช้เป็นค่า default / max ของ <input type="date"> */
export function todayDateKey(): string {
  return bkkDateKey(new Date());
}

/**
 * แปลง "YYYY-MM-DD" (วันที่ตามเวลาไทยที่ผู้ใช้เลือก) -> Date instant
 * ที่ตรงกับ "เที่ยงวันเวลาไทย" ของวันนั้น (12:00 +07:00 = 05:00Z).
 * เที่ยงวันกันปัญหา DST/ปัดเศษ — instant อยู่กลางวันไทยเสมอ ไม่ข้ามวัน.
 */
export function bkkDateKeyToInstant(dateKey: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  // 12:00 น. เวลาไทย = 05:00 UTC
  const instant = new Date(Date.UTC(year, month - 1, day, 5, 0, 0));
  // ตรวจ overflow (เช่น 2026-02-31 -> เด้งไปเดือนถัดไป)
  const parts = bkkParts(instant);
  if (parts.year !== year || parts.month !== month || parts.day !== day) {
    return null;
  }
  return instant;
}

/** ขอบเขต instant ของเดือน "YYYY-MM" (เวลาไทย): [gte, lt) สำหรับ where occurredAt */
export function bkkMonthRange(monthKey: string): { gte: Date; lt: Date } {
  const [y, mo] = monthKey.split("-").map(Number);
  const gte = new Date(Date.UTC(y, mo - 1, 1) - BKK_OFFSET_MS); // 00:00 ไทย วันที่ 1
  const lt = new Date(Date.UTC(mo === 12 ? y + 1 : y, mo === 12 ? 0 : mo, 1) - BKK_OFFSET_MS); // 00:00 ไทย วันที่ 1 เดือนถัดไป
  return { gte, lt };
}

/** ขอบเขต instant ของวัน "YYYY-MM-DD" (เวลาไทย): [gte, lt) */
export function bkkDayRange(dateKey: string): { gte: Date; lt: Date } {
  const [y, mo, d] = dateKey.split("-").map(Number);
  const gte = new Date(Date.UTC(y, mo - 1, d) - BKK_OFFSET_MS);
  const lt = new Date(gte.getTime() + 24 * 60 * 60 * 1000);
  return { gte, lt };
}

/** เดือนก่อนหน้าของ "YYYY-MM" */
export function prevMonthKey(monthKey: string): string {
  const [y, mo] = monthKey.split("-").map(Number);
  if (mo === 1) return `${y - 1}-12`;
  return `${y}-${pad(mo - 1)}`;
}

/** "YYYY-MM" -> ข้อความไทย เช่น "2026-06" -> "มิถุนายน 2569" */
export function monthKeyToThai(monthKey: string): string {
  const [y, mo] = monthKey.split("-").map(Number);
  const names = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
  ];
  return `${names[mo - 1] ?? ""} ${y + 543}`;
}

/** instant -> ข้อความวันที่ไทยสั้น เช่น "2 มิ.ย. 69" */
export function formatThaiDate(instant: Date): string {
  const { year, month, day } = bkkParts(instant);
  const short = [
    "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
    "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
  ];
  return `${day} ${short[month - 1] ?? ""} ${String((year + 543) % 100).padStart(2, "0")}`;
}

/** instant -> ข้อความ วัน+เวลา ไทย เช่น "2 มิ.ย. 69 14:30" (ใช้ในประวัติแก้ไข) */
export function formatThaiDateTime(instant: Date): string {
  const shifted = new Date(instant.getTime() + BKK_OFFSET_MS);
  const hh = pad(shifted.getUTCHours());
  const mm = pad(shifted.getUTCMinutes());
  return `${formatThaiDate(instant)} ${hh}:${mm}`;
}

/** ตัวเลือกเดือนสำหรับ dropdown: { value: "YYYY-MM", label: "เดือน ปีพ.ศ." } */
export type MonthOption = { value: string; label: string };

/**
 * รายการเดือนย้อนหลัง count เดือน (รวมเดือนปัจจุบัน) ใหม่ -> เก่า ตามเวลาไทย.
 * value เป็น monthKey "YYYY-MM"; label เป็นชื่อเดือนไทยเต็ม + ปี พ.ศ. เช่น "มิถุนายน 2569".
 * ใช้สร้างตัวเลือกเดือนใน UI (ดูสรุปย้อนหลัง) — ต่อยอด currentMonthKey/prevMonthKey เดิม (ไม่ทำ tz ซ้ำ).
 */
export function recentMonths(count = 12): MonthOption[] {
  const out: MonthOption[] = [];
  let key = currentMonthKey();
  for (let i = 0; i < count; i++) {
    out.push({ value: key, label: monthKeyToThai(key) });
    key = prevMonthKey(key);
  }
  return out;
}

/** ขอบเขตวันที่ของเดือน "YYYY-MM" เป็นสตริง "YYYY-MM-DD" (วันแรก–วันสุดท้าย) — ทำลิงก์ตัวกรอง /entries (to=วันสุดท้าย, inclusive) */
export function monthDateRange(monthKey: string): { from: string; to: string } {
  const [y, mo] = monthKey.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  return { from: `${monthKey}-01`, to: `${monthKey}-${pad(lastDay)}` };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
