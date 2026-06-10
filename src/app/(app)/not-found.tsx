import Link from "next/link";
import { Home } from "lucide-react";

import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";

/**
 * 404 ของกลุ่ม (app) — ข้อความไทยเป็นมิตร + ปุ่มกลับหน้าหลักสไตล์แบรนด์.
 * เรนเดอร์ภายใน <main> ของ layout จึงไม่ห่อ main ซ้ำ.
 */
export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-brand/25 bg-brand-soft/40 px-6 py-14 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand/12 shadow-warm-sm">
        <BrandMark className="h-9 w-9" />
      </div>
      <div className="space-y-1">
        <p className="text-2xl font-bold tracking-tight text-foreground">ไม่พบหน้านี้</p>
        <p className="max-w-[34ch] text-sm text-muted-foreground">
          หน้าที่คุณกำลังหาอาจถูกย้ายหรือไม่มีอยู่แล้ว กลับไปหน้าหลักเพื่อดูสรุปของคุณได้เลย
        </p>
      </div>
      <Button asChild className="mt-1">
        <Link href="/">
          <Home className="h-4 w-4" />
          กลับหน้าหลัก
        </Link>
      </Button>
    </div>
  );
}
