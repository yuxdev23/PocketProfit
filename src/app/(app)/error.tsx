"use client";

import { useEffect } from "react";
import { RotateCw } from "lucide-react";

import { ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";

/**
 * Error boundary ของกลุ่ม (app) — แสดงการ์ดผิดพลาดแบบอบอุ่น ไม่โชว์ stack ให้ผู้ใช้.
 * ปุ่ม "ลองใหม่อีกครั้ง" เรียก reset() เพื่อ re-render เซกเมนต์.
 * เรนเดอร์ภายใน <main> ของ layout จึงไม่ห่อ main ซ้ำ.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // log ฝั่ง client เพื่อ debug — ไม่แสดงรายละเอียดให้ผู้ใช้เห็น
    console.error(error);
  }, [error]);

  return (
    <div className="space-y-4 py-6">
      <ErrorState
        message="อุ๊ปส์ มีบางอย่างผิดพลาด"
        className="flex-col"
      />
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="max-w-[34ch] text-sm text-muted-foreground">
          ลองโหลดใหม่อีกครั้งได้เลย ข้อมูลของคุณยังอยู่ครบ
        </p>
        <Button onClick={() => reset()} className="mt-1">
          <RotateCw className="h-4 w-4" />
          ลองใหม่อีกครั้ง
        </Button>
      </div>
    </div>
  );
}
