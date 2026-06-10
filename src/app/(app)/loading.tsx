import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton ระหว่างโหลดหน้าใน (app) — จังหวะเดียวกับหน้าจริง (header → hero → พิลล์ → การ์ด → ลิสต์).
 * เรนเดอร์ภายใน <main> ของ layout (max-w-5xl, มี padding อยู่แล้ว) จึงไม่ห่อ main ซ้ำ.
 */
export default function Loading() {
  return (
    <div className="space-y-5">
      {/* หัวข้อหน้า */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-6 w-40" />
      </div>

      {/* hero กำไร */}
      <Skeleton className="h-44 w-full rounded-3xl" />

      {/* พิลล์ รายรับ / รายจ่าย */}
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-[68px] rounded-2xl" />
        <Skeleton className="h-[68px] rounded-2xl" />
      </div>

      {/* การ์ดสรุป (เป้า/งบ) */}
      <Skeleton className="h-24 w-full rounded-2xl" />

      {/* ลิสต์รายการ */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-44 w-full rounded-2xl" />
      </div>
    </div>
  );
}
