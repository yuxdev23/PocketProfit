"use client";

/**
 * EditEntryDialog (EDGE-1, F7) — แก้รายการย้อนหลัง บังคับเหตุผล + เก็บประวัติ.
 * reuse EntryFields (withReason=true). server (updateEntry) re-validate + บันทึก diff.
 */

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  EntryFields,
  buildEntryFormData,
  useEntryForm,
  type CategoryOption,
  type EntryFormValues,
} from "@/components/entry-form-fields";
import { updateEntry } from "@/lib/actions/entries";
import { parseReceiptPaths } from "@/lib/receipts";

export type EditEntryInitial = {
  id: string;
  type: "income" | "expense";
  amount: string; // baht string
  categoryId: string;
  date: string; // YYYY-MM-DD
  note: string;
  vat7: boolean;
  receiptPaths: string | null;
};

export function EditEntryDialog({
  open,
  onOpenChange,
  categories,
  todayKey,
  initial,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  categories: CategoryOption[];
  todayKey: string;
  initial: EditEntryInitial;
}) {
  const form = useEntryForm({
    withReason: true,
    todayKey,
    defaults: {
      type: initial.type,
      amount: initial.amount,
      categoryId: initial.categoryId,
      date: initial.date,
      note: initial.note,
      vat7: initial.vat7,
    },
  });
  const [receiptFiles, setReceiptFiles] = useState<File[]>([]);
  const [existingPaths, setExistingPaths] = useState<string[]>(() =>
    parseReceiptPaths(initial.receiptPaths),
  );
  const [pending, startTransition] = useTransition();

  // ทุกครั้งที่เปิด dialog (หรือสลับรายการ) → reset ฟอร์มกลับเป็นค่าปัจจุบันของรายการ:
  //  - ล้าง "เหตุผลการแก้ไข" ให้ว่างเสมอ (เหตุผลเป็นของการแก้ครั้งนั้น ๆ ไม่ค้างข้ามรอบ)
  //  - เคลียร์ dirty → ซ่อนข้อความ "ตรวจสอบสลิปก่อนบันทึกรายการ" จนกว่าจะแก้ยอดใหม่
  //  - sync รูปเดิม + ล้างรูปใหม่ที่ค้างจากครั้งก่อน
  useEffect(() => {
    if (open) {
      form.reset({
        type: initial.type,
        amount: initial.amount,
        categoryId: initial.categoryId,
        date: initial.date,
        note: initial.note,
        vat7: initial.vat7,
        reason: "",
      });
      setReceiptFiles([]);
      setExistingPaths(parseReceiptPaths(initial.receiptPaths));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial.id]);

  const onValid = (values: EntryFormValues) => {
    startTransition(async () => {
      const fd = buildEntryFormData(values, receiptFiles, existingPaths, { entryId: initial.id });
      try {
        const res = await updateEntry(fd);
        if (res.ok) {
          toast.success("แก้ไขรายการแล้ว");
          onOpenChange(false);
          return;
        }
        if ("needConfirm" in res) {
          toast.error("ไม่สามารถบันทึกได้");
          return;
        }
        if (res.fieldErrors) {
          for (const [k, v] of Object.entries(res.fieldErrors)) {
            form.setError(k as keyof EntryFormValues, { message: v });
          }
        }
        toast.error(res.error);
      } catch {
        toast.error("บันทึกไม่สำเร็จ ลองอีกครั้ง — ข้อมูลที่กรอกยังอยู่");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] gap-0 overflow-y-auto p-0 sm:max-w-md">
        <DialogHeader className="border-b border-border p-4">
          <DialogTitle>แก้ไขรายการ</DialogTitle>
          <DialogDescription>การแก้ไขย้อนหลังต้องระบุเหตุผล และจะถูกเก็บประวัติไว้</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onValid)}>
          <div className="p-4">
            <EntryFields
              form={form}
              categories={categories}
              todayKey={todayKey}
              withReason
              receiptFiles={receiptFiles}
              onReceiptFilesChange={setReceiptFiles}
              existingReceiptPaths={existingPaths}
              onExistingReceiptPathsChange={setExistingPaths}
            />
          </div>
          <DialogFooter className="sticky bottom-0 gap-2 border-t border-border bg-background p-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
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
                "บันทึกการแก้ไข"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
