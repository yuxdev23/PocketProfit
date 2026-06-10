import { requireUser } from "@/lib/auth";
import { monthlyVatSummary } from "@/lib/queries";
import { recentMonths, currentMonthKey, monthKeyToThai } from "@/lib/dates";
import { VatView } from "@/components/vat-view";

export const dynamic = "force-dynamic";

/**
 * หน้า VAT (E) — บ้านเต็มตัวของภาษีมูลค่าเพิ่ม.
 * ใช้การคำนวณ monthlyVatSummary เดิมของ PocketProfit (output/input/net ครบ ละเอียดกว่า shop).
 * เลือกเดือนย้อนหลังผ่าน ?m=YYYY-MM (ตรวจกับ recentMonths กัน input เพี้ยน) · scope ด้วย userId.
 */
export default async function VatPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;

  const months = recentMonths(12);
  const monthKey =
    sp.m && months.some((m) => m.value === sp.m) ? sp.m : currentMonthKey();

  const vat = await monthlyVatSummary(user.id, monthKey);

  return (
    <VatView
      monthKey={monthKey}
      monthLabel={monthKeyToThai(monthKey)}
      months={months}
      vat={vat}
    />
  );
}
