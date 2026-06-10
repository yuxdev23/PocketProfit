"use client";

/**
 * DateStepper (K) — แถบเลื่อนดู "วันย้อนหลัง" บนหน้าหลัก.
 * - ◀ / ▶ เลื่อนทีละวัน (อิงปฏิทินเวลาไทย Asia/Bangkok, UTC+7 — ไม่มี DST)
 * - ปิดปุ่ม ▶ เมื่ออยู่ "วันนี้" (ห้ามไปอนาคต)
 * - เปลี่ยนวันผ่าน searchParam ?d=YYYY-MM-DD; วันนี้ = ไม่มี param (URL สะอาด)
 * - ระบุวันด้วยข้อความไทย + ปุ่มลัด "กลับมาวันนี้" ตอนดูย้อนหลัง
 *
 * คอมโพเนนต์นี้คำนวณ dateKey เองแบบ pure (ไม่ดึง lib/dates ที่เป็น server-only)
 * แต่ใช้ convention เดียวกับ @/lib/dates เป๊ะ (บวก offset +7 ชม. แล้วอ่านเป็น UTC).
 */

import { useRouter } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const BKK_OFFSET_MS = 7 * 60 * 60 * 1000; // +07:00 (ตรงกับ lib/dates)

const THAI_MONTH_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];
const THAI_WEEKDAY = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** วันนี้ (เวลาไทย) เป็น "YYYY-MM-DD" */
function todayKey(): string {
  const s = new Date(Date.now() + BKK_OFFSET_MS);
  return `${s.getUTCFullYear()}-${pad(s.getUTCMonth() + 1)}-${pad(s.getUTCDate())}`;
}

/** เลื่อน dateKey ไป n วัน (ผ่าน "เที่ยงวันไทย" กัน DST/ปัดเศษ ตาม lib/dates) */
function shiftKey(dateKey: string, n: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  // เที่ยงวันไทย 12:00 = 05:00Z
  const base = new Date(Date.UTC(y, m - 1, d, 5, 0, 0));
  const next = new Date(base.getTime() + n * 24 * 60 * 60 * 1000);
  const s = new Date(next.getTime() + BKK_OFFSET_MS);
  return `${s.getUTCFullYear()}-${pad(s.getUTCMonth() + 1)}-${pad(s.getUTCDate())}`;
}

/** "พฤ. 2 มิ.ย. 69" จาก dateKey */
function formatThaiDay(dateKey: string): { weekday: string; full: string } {
  const [y, m, d] = dateKey.split("-").map(Number);
  const noon = new Date(Date.UTC(y, m - 1, d, 5, 0, 0));
  const weekday = THAI_WEEKDAY[noon.getUTCDay()] ?? "";
  const full = `${d} ${THAI_MONTH_SHORT[m - 1] ?? ""} ${String((y + 543) % 100).padStart(2, "0")}`;
  return { weekday, full };
}

export function DateStepper({ dateKey }: { dateKey: string }) {
  const router = useRouter();
  const today = todayKey();
  const atToday = dateKey >= today;
  const { weekday, full } = formatThaiDay(dateKey);

  function go(delta: number) {
    const next = shiftKey(dateKey, delta);
    if (next > today) return; // ห้ามไปอนาคต
    router.push(next === today ? "/" : `/?d=${next}`);
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <Button
        variant="ghost"
        size="icon"
        className="h-11 w-11 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
        onClick={() => go(-1)}
        aria-label="วันก่อนหน้า"
      >
        <ChevronLeft className="h-5 w-5" />
      </Button>

      <div className="flex min-w-0 flex-col items-center text-center">
        <div className="flex items-center gap-1.5">
          <CalendarDays className="h-4 w-4 shrink-0 text-brand" />
          <span className="truncate text-sm font-semibold text-foreground">
            {atToday ? "วันนี้" : `${weekday} ${full}`}
          </span>
        </div>
        {atToday ? (
          <span className="text-xs text-muted-foreground">แตะลูกศรเพื่อดูย้อนหลัง</span>
        ) : (
          <button
            type="button"
            onClick={() => router.push("/")}
            className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
          >
            <RotateCcw className="h-3 w-3" />
            กลับมาวันนี้
          </button>
        )}
      </div>

      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "h-11 w-11 shrink-0 rounded-full text-muted-foreground hover:text-foreground",
          "disabled:opacity-30",
        )}
        onClick={() => go(1)}
        disabled={atToday}
        aria-label="วันถัดไป"
      >
        <ChevronRight className="h-5 w-5" />
      </Button>
    </div>
  );
}
