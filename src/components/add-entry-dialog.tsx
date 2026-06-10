"use client";

/**
 * AddEntryDialog (F1, DoD-1, EDGE-2, EDGE-4, N3) — หัวใจของแอป.
 * - validation-first: react-hook-form + zod (client) ก่อน submit.
 * - amount เป็นพระเอก (ใหญ่ กึ่งกลาง โฟกัสอัตโนมัติ); วันที่/หมายเหตุ ซ่อนใต้ "ตัวเลือกเพิ่มเติม".
 * - server re-validate; ถ้า needConfirm (ซ้ำ + สูงผิดปกติ) -> เปิด AlertDialog ยืนยัน
 *   "รวมทุกเหตุผลในกล่องเดียว" โดยฟอร์มยังเปิด ค่ายังอยู่ (กันข้อมูลหาย).
 * - เซฟล้มเหลว -> toast.error + ฟอร์มไม่ปิด ไม่ล้างค่า.
 */

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { AlertTriangle, Loader2, ShieldCheck } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import {
  EntryFields,
  buildEntryFormData,
  useEntryForm,
  type CategoryOption,
  type EntryFormValues,
} from "@/components/entry-form-fields";
import { createEntry, type ConfirmReason } from "@/lib/actions/entries";
import { bkkDateKeyToInstant, formatThaiDate } from "@/lib/dates";

/** เหตุผลทั้งชุดที่ server ขอให้ยืนยัน (ซ้ำ + สูงผิดปกติ) — โชว์รวมในกล่องเดียว. */
type PendingConfirm = { title: string; reasons: ConfirmReason[] } | null;

export function AddEntryDialog({
  open,
  onOpenChange,
  categories,
  todayKey,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  categories: CategoryOption[];
  todayKey: string;
}) {
  const form = useEntryForm({ withReason: false, defaults: {}, todayKey });
  const [receiptFiles, setReceiptFiles] = useState<File[]>([]);
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<PendingConfirm>(null);

  function reset() {
    form.reset({ type: "expense", amount: "", categoryId: "", date: todayKey, note: "", vat7: false, reason: "" });
    setReceiptFiles([]);
    setConfirm(null);
  }

  function submit(values: EntryFormValues, confirmKinds?: string) {
    startTransition(async () => {
      const fd = buildEntryFormData(values, receiptFiles, [], confirmKinds ? { confirm: confirmKinds } : {});
      try {
        const res = await createEntry(fd);
        if (res.ok) {
          // ลงวันย้อนหลัง -> บอกวันที่ให้ชัด, วันนี้ -> ข้อความสั้นๆ ให้สบายใจ
          const instant = bkkDateKeyToInstant(values.date);
          if (values.date !== todayKey && instant) {
            toast.success(`บันทึกลงวันที่ ${formatThaiDate(instant)} แล้ว`);
          } else {
            toast.success("บันทึกรายการแล้ว");
          }
          reset();
          onOpenChange(false);
          return;
        }
        if ("needConfirm" in res) {
          setConfirm(res.needConfirm);
          return;
        }
        if (res.fieldErrors) {
          for (const [k, v] of Object.entries(res.fieldErrors)) {
            form.setError(k as keyof EntryFormValues, { message: v });
          }
        }
        toast.error(res.error);
      } catch {
        // เน็ตหลุด/500 — ฟอร์มไม่ปิด ค่าไม่หาย
        toast.error("บันทึกไม่สำเร็จ ลองอีกครั้ง — ข้อมูลที่กรอกยังอยู่");
      }
    });
  }

  const onValid = (values: EntryFormValues) => submit(values);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !pending) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-h-[92vh] gap-0 overflow-y-auto p-0 sm:max-w-md">
        <DialogHeader className="border-b border-border p-4">
          <DialogTitle>เพิ่มรายการ</DialogTitle>
          <DialogDescription>เลือกประเภท ใส่จำนวนเงิน เลือกหมวด แล้วบันทึก</DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onValid)}>
          <div className="p-4">
            <EntryFields
              form={form}
              categories={categories}
              todayKey={todayKey}
              withReason={false}
              receiptFiles={receiptFiles}
              onReceiptFilesChange={setReceiptFiles}
            />
          </div>
          <DialogFooter className="sticky bottom-0 gap-2 border-t border-border bg-background p-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                reset();
                onOpenChange(false);
              }}
              disabled={pending}
            >
              ยกเลิก
            </Button>
            <Button
              type="submit"
              className="h-12 flex-1 bg-brand text-brand-foreground hover:bg-brand/90"
              disabled={pending}
            >
              {pending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> กำลังบันทึก…
                </>
              ) : (
                "บันทึก"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      {/* Confirm interstitial — EDGE-2 / EDGE-4: รวมทุกเหตุผล (ซ้ำ + สูงผิดปกติ) ในกล่องเดียว */}
      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader className="items-center text-center sm:text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand/15 text-brand">
              <ShieldCheck className="h-7 w-7" />
            </span>
            <AlertDialogTitle className="mt-1">
              {confirm?.title ?? "ขอเช็กอีกนิดก่อนบันทึก"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              เจอจุดที่อยากให้ดูก่อนบันทึก ถ้าถูกต้องแล้วกดยืนยันได้เลย
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="space-y-2">
            {(confirm?.reasons ?? []).map((r) => (
              <li
                key={r.kind}
                className="flex gap-2 rounded-xl border border-brand/25 bg-brand/5 p-3 text-sm text-foreground"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                <span>{r.message}</span>
              </li>
            ))}
          </ul>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>กลับไปแก้ไข</AlertDialogCancel>
            <AlertDialogAction
              className="bg-brand text-brand-foreground hover:bg-brand/90"
              disabled={pending}
              onClick={(e) => {
                e.preventDefault();
                // ยืนยัน -> ส่งซ้ำพร้อม flag confirm ของ "ทุกเหตุผล" รวดเดียว (ข้ามการเตือนทั้งหมด)
                const kinds = (confirm?.reasons ?? []).map((r) => r.kind).join(",");
                setConfirm(null);
                if (kinds) submit(form.getValues(), kinds);
              }}
            >
              ยืนยันบันทึก
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
