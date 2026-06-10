/**
 * Calculation guards — กันหารด้วยศูนย์ / NaN / Infinity ทุกที่ (proactive edge).
 * ทุกฟังก์ชันคืนค่าที่ "ปลอดภัยต่อการแสดงผล" เสมอ.
 */

/**
 * progress% = actual/target. ไม่ clamp เพดาน → แสดงเกิน 100% ได้ (ทำเกินเป้า/เพดาน).
 * คงพื้น 0 (ไม่ติดลบ) + target<=0 -> 0 (ไม่ NaN). วงแหวน/แถบไป clamp "เฉพาะภาพ" เอง. (F4)
 */
export function progressPct(actualSatang: number, targetSatang: number): number {
  if (!Number.isFinite(actualSatang) || !Number.isFinite(targetSatang)) return 0;
  if (targetSatang <= 0) return 0;
  const pct = Math.round((actualSatang / targetSatang) * 100);
  return Math.max(0, pct);
}

/** อัตราการใช้งบ% — เหมือน progress แต่ "ไม่ clamp เพดาน" เพื่อให้เห็นว่าเกินงบกี่ % (F2/DoD-2). */
export function usagePct(actualSatang: number, budgetSatang: number): number {
  if (!Number.isFinite(actualSatang) || !Number.isFinite(budgetSatang)) return 0;
  if (budgetSatang <= 0) return 0;
  return Math.max(0, Math.round((actualSatang / budgetSatang) * 100));
}

/** margin% = (price-cost)/price, price<=0 -> 0. อาจติดลบได้ (ขายต่ำกว่าทุน). (F5/DoD-5) */
export function marginPct(costSatang: number, priceSatang: number): number {
  if (!Number.isFinite(costSatang) || !Number.isFinite(priceSatang)) return 0;
  if (priceSatang <= 0) return 0;
  return Math.round(((priceSatang - costSatang) / priceSatang) * 100);
}

/**
 * เปอร์เซ็นต์การเปลี่ยนแปลงเทียบเดือนก่อน (กำไรสุทธิ). คืน null ถ้าเทียบไม่ได้
 * (เดือนก่อน = 0 หรือไม่มีข้อมูล) -> หน้า UI แสดง "—" แทน Infinity%. (F3/DoD-3)
 */
export function changePct(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (previous === 0) return null;
  return Math.round(((current - previous) / Math.abs(previous)) * 100);
}

/** ทิศทางการเปลี่ยนแปลง: ใช้เลือกไอคอน ▲ / ▼ / — และสี */
export type Direction = "up" | "down" | "flat";
export function direction(current: number, previous: number): Direction {
  if (current > previous) return "up";
  if (current < previous) return "down";
  return "flat";
}
