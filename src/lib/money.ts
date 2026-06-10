/**
 * Money helpers. ทุกยอดเงินเก็บเป็น "สตางค์" (integer) เสมอ — ไม่เก็บ float บาท.
 * 1 บาท = 100 สตางค์.
 */

/** บาท (number/string) -> สตางค์ (integer, ปัด 2 ตำแหน่ง). คืน NaN ถ้าแปลงไม่ได้. */
export function bahtToSatang(baht: number | string): number {
  const n = typeof baht === "string" ? Number(baht.trim()) : baht;
  if (!Number.isFinite(n)) return NaN;
  return Math.round(n * 100);
}

/** สตางค์ -> บาท (number). */
export function satangToBaht(satang: number): number {
  return satang / 100;
}

const bahtFormatter = new Intl.NumberFormat("th-TH", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/**
 * แสดงยอดเงิน (สตางค์) เป็นข้อความบาท เช่น 200000 -> "2,000".
 * ไม่ใส่สัญลักษณ์ ฿ (ให้ผู้เรียกเติมเอง). กัน NaN -> "0".
 */
export function formatBaht(satang: number): string {
  const safe = Number.isFinite(satang) ? satang : 0;
  return bahtFormatter.format(satangToBaht(safe));
}

/** แสดงพร้อมสัญลักษณ์ "฿" นำหน้า เช่น "฿2,000". */
export function formatMoney(satang: number): string {
  return `฿${formatBaht(satang)}`;
}

/**
 * แสดงยอดแบบมีเครื่องหมาย +/- นำหน้า (สำหรับกำไรสุทธิ).
 * บวก -> "+฿300", ลบ -> "−฿300" (ใช้ minus sign จริง), ศูนย์ -> "฿0".
 */
export function formatSignedMoney(satang: number): string {
  const safe = Number.isFinite(satang) ? satang : 0;
  if (safe > 0) return `+${formatMoney(safe)}`;
  if (safe < 0) return `−${formatMoney(Math.abs(safe))}`;
  return formatMoney(0);
}
