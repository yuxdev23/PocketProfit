import { requireUser } from "@/lib/auth";
import { listCategories, todayDateKey } from "@/lib/queries";
import { formatThaiDate } from "@/lib/dates";
import { TopNav, BottomNav, MobileHeader } from "@/components/app-nav";
import { EntryFab } from "@/components/entry-fab";
import { AssistantFab } from "@/components/assistant/assistant-fab";
import { FabDock } from "@/components/fab-dock";
import { BrandWordmark } from "@/components/brand-mark";

/**
 * Protected layout — ทุกหน้าใน (app) ผ่าน requireUser() (AUTH-5 ผ่าน middleware + ที่นี่).
 * โหลดหมวดของผู้ใช้ครั้งเดียวเพื่อส่งให้ FAB/AddEntryDialog ทุกหน้า.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const categories = await listCategories(user.id);
  const options = categories.map((c) => ({
    id: c.id,
    name: c.name,
    kind: c.kind as "income" | "expense",
  }));

  // วันที่สำหรับแถบแบรนด์ในภาพ capture (เวลาไทย) — เช่น "10 มิ.ย. 69"
  const capturedAt = formatThaiDate(new Date());

  return (
    <div className="min-h-screen bg-background">
      <TopNav email={user.email} />
      <MobileHeader />
      <main className="mx-auto w-full max-w-5xl pb-24 md:pb-8">
        {/* [data-capture-root] = เป้าหมายของปุ่ม "Capture หน้านี้" (กำไรสุทธิ/VAT).
            แยก padding ของเนื้อหา (p-4) ออกจากระยะเผื่อ FAB ของ <main> เพื่อให้ภาพที่จับ
            ได้ขอบสวยเท่ากันทุกด้าน ไม่มีช่องว่างใต้ปุ่มลอยติดมา. */}
        <div data-capture-root className="px-4 pb-4 pt-4">
          {/* แถบแบรนด์ "เฉพาะในภาพ capture" — ซ่อนบนจอ (display:none) แล้วปุ่ม Capture
              จะปลดซ่อนเฉพาะใน clone ตอนจับภาพ จึงไม่ทำให้หน้าจอจริงกระพริบ/ขยับ. */}
          <div
            data-capture-only
            aria-hidden
            style={{ display: "none" }}
            className="mb-4 flex items-center justify-between gap-3 border-b border-border pb-3"
          >
            <BrandWordmark />
            <span className="shrink-0 text-xs font-medium text-muted-foreground">
              {capturedAt}
            </span>
          </div>
          {children}
        </div>
      </main>
      <BottomNav />
      <FabDock>
        <EntryFab categories={options} todayKey={todayDateKey()} />
        <AssistantFab />
      </FabDock>
    </div>
  );
}
