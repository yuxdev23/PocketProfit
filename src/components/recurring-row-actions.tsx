"use client";

/**
 * ปุ่มจัดการต่อแถวรายการประจำ (EDGE-3 ข้ามเดือน / เปิด-ปิด / ลบ).
 * ทุก action เป็น server action ที่ผูก userId. ใช้ useTransition + sonner.
 */

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { MinusCircle, RotateCcw, Pause, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DeleteButton } from "@/components/delete-button";
import {
  skipRecurringThisMonth,
  unskipRecurringThisMonth,
  toggleRecurringActive,
  deleteRecurringRule,
} from "@/lib/actions/recurring";

export function RecurringRowActions({
  id,
  name,
  active,
  skippedThisMonth,
  monthLabel,
  isCurrentMonth = true,
}: {
  id: string;
  name: string;
  active: boolean;
  skippedThisMonth: boolean;
  monthLabel: string;
  /**
   * เดือนที่กำลังดูคือ "เดือนปัจจุบัน" หรือไม่ (ดีฟอลต์ true เพื่อให้จุดเรียกเดิมไม่เปลี่ยน).
   * action ข้าม/ยกเลิกข้าม ทำงานกับ "เดือนปัจจุบัน" เท่านั้น → ดูเดือนย้อนหลังจะซ่อนปุ่มข้าม
   * ป้องกันความเข้าใจผิด (เปิด/ปิด และลบ ยังใช้ได้ทุกเดือน).
   */
  isCurrentMonth?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [confirmSkip, setConfirmSkip] = useState(false);

  function doSkip() {
    startTransition(async () => {
      const res = await skipRecurringThisMonth(id);
      if (res.ok) toast.success(`ข้าม "${name}" เฉพาะ ${monthLabel} แล้ว`);
      else if ("error" in res) toast.error(res.error);
      setConfirmSkip(false);
    });
  }

  function doUnskip() {
    startTransition(async () => {
      const res = await unskipRecurringThisMonth(id);
      if (res.ok) toast.success(`ยกเลิกการข้าม "${name}" แล้ว`);
      else if ("error" in res) toast.error(res.error);
    });
  }

  function doToggle() {
    startTransition(async () => {
      const res = await toggleRecurringActive(id, !active);
      if (res.ok) toast.success(active ? "หยุดรายการประจำแล้ว" : "เปิดรายการประจำแล้ว");
      else if ("error" in res) toast.error(res.error);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {/* EDGE-3: ข้าม / ยกเลิกข้าม เฉพาะเดือนนี้ (แสดงเมื่อกำลังดูเดือนปัจจุบันเท่านั้น) */}
      {active && isCurrentMonth ? (
        skippedThisMonth ? (
          <Button variant="outline" size="sm" className="h-8" disabled={pending} onClick={doUnskip}>
            <RotateCcw className="mr-1 h-3.5 w-3.5" /> ยกเลิกข้าม
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="h-8" disabled={pending} onClick={() => setConfirmSkip(true)}>
            <MinusCircle className="mr-1 h-3.5 w-3.5" /> ข้ามเดือนนี้
          </Button>
        )
      ) : null}

      {/* เปิด/ปิดถาวร */}
      <Button variant="ghost" size="sm" className="h-8" disabled={pending} onClick={doToggle}>
        {active ? (
          <>
            <Pause className="mr-1 h-3.5 w-3.5" /> หยุด
          </>
        ) : (
          <>
            <Play className="mr-1 h-3.5 w-3.5" /> เปิดใช้
          </>
        )}
      </Button>

      <DeleteButton
        id={id}
        action={deleteRecurringRule}
        title="ลบรายการประจำนี้?"
        description="รูปแบบจะถูกลบถาวร (รายการที่เคยลงไว้ยังอยู่) เดือนถัดไปจะไม่สร้างให้อีก"
        successMessage="ลบรายการประจำแล้ว"
      />

      <AlertDialog open={confirmSkip} onOpenChange={setConfirmSkip}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ข้าม &quot;{name}&quot; เฉพาะ {monthLabel}?</AlertDialogTitle>
            <AlertDialogDescription>
              ยอด {monthLabel} จะไม่รวมรายการนี้ และจะลบรายการที่ลงไว้ของเดือนนี้ (ถ้ามี) — แต่รูปแบบรายการประจำยังอยู่ เดือนถัดไปกลับมาปกติ
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              className="bg-brand text-brand-foreground hover:bg-brand/90"
              disabled={pending}
              onClick={(e) => {
                e.preventDefault();
                doSkip();
              }}
            >
              ข้ามเดือนนี้
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
