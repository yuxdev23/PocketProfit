"use client";

/**
 * ปุ่มลอย "ผู้ช่วย PocketProfit" — โผล่ทุกหน้าในแอป (mount ใน (app)/layout).
 *
 * ตำแหน่ง: วาง "เหนือ" ปุ่มเพิ่มรายการ (EntryFab อยู่ที่ bottom-[72px] มือถือ / bottom-6 จอใหญ่, สูง h-14)
 * จึงเว้นระยะให้ไม่ทับกัน: bottom-[140px] (มือถือ) / bottom-[92px] (จอใหญ่). z สูงกว่าเล็กน้อย.
 * เป็นปุ่มกลมไอคอน (เล็กกว่า CTA หลัก) เพื่อไม่แย่งความเด่นของปุ่มเพิ่มรายการ.
 */

import { useState } from "react";
import { Sparkles } from "lucide-react";

import { AssistantSheet } from "@/components/assistant/assistant-sheet";

export function AssistantFab() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="ผู้ช่วย PocketProfit"
        title="ผู้ช่วย PocketProfit"
        className="fixed bottom-[140px] right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-brand/30 bg-card text-brand shadow-warm transition-transform hover:scale-105 active:scale-95 md:bottom-[92px]"
      >
        <Sparkles className="h-6 w-6" />
      </button>
      <AssistantSheet open={open} onOpenChange={setOpen} />
    </>
  );
}
