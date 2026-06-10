"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";

import { AddEntryDialog } from "@/components/add-entry-dialog";
import { CapturePageButton } from "@/components/capture-page-button";
import type { CategoryOption } from "@/components/entry-form-fields";

/**
 * หน้าสรุปอ่านอย่างเดียวที่แสดงปุ่ม "Capture หน้านี้" แทนปุ่ม "เพิ่มรายการ"
 * (จับภาพทั้งหน้าไว้แชร์/เก็บ). key = pathname ตรงตัว, fileBase = ฐานชื่อไฟล์ภาพ.
 */
const CAPTURE_PAGES: Record<string, { label: string; fileBase: string }> = {
  "/profit": { label: "Capture หน้านี้", fileBase: "กำไรสุทธิ" },
  "/vat": { label: "Capture หน้านี้", fileBase: "ภาษีมูลค่าเพิ่ม" },
};

/**
 * ปุ่มลอย (FAB) ประจำทุกหน้า — วางบน BottomNav บนมือถือ; มุมขวาล่างบน desktop:
 * - หน้าสรุป (/profit, /vat) → "Capture หน้านี้" จับภาพทั้งหน้าเป็น PNG
 * - หน้าอื่น ๆ → "เพิ่มรายการ" เปิด AddEntryDialog (เซฟจริงที่ปุ่ม "บันทึก" ในฟอร์ม)
 */
export function EntryFab({
  categories,
  todayKey,
}: {
  categories: CategoryOption[];
  todayKey: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const capture = CAPTURE_PAGES[pathname];
  if (capture) {
    return <CapturePageButton label={capture.label} fileBase={capture.fileBase} />;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="เพิ่มรายการ"
        className="fixed bottom-[72px] right-4 z-40 flex h-14 items-center gap-2 rounded-full bg-brand px-5 text-brand-foreground shadow-lg transition-transform hover:scale-105 active:scale-95 md:bottom-6"
      >
        <Plus className="h-6 w-6" />
        <span className="pr-1 text-base font-semibold">เพิ่มรายการ</span>
      </button>
      <AddEntryDialog
        open={open}
        onOpenChange={setOpen}
        categories={categories}
        todayKey={todayKey}
      />
    </>
  );
}
