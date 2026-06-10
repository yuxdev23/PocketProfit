"use client";

/**
 * AddRecurringDialog (F6) — ตั้งค่าใช้จ่าย/รายรับประจำที่เกิดซ้ำทุกเดือน.
 * validation-first: react-hook-form + zod (recurringSchema). server re-validate.
 */

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { CalendarCheck, Loader2, Plus } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { recurringSchema, type RecurringInput } from "@/lib/validation";
import { createRecurringRule, runRecurringForMonth } from "@/lib/actions/recurring";
import type { MonthOption } from "@/lib/dates";
import type { CategoryOption } from "@/components/entry-form-fields";

export function AddRecurringDialog({ categories }: { categories: CategoryOption[] }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const form = useForm<RecurringInput>({
    resolver: zodResolver(recurringSchema),
    defaultValues: { name: "", type: "expense", categoryId: "", amount: "", dayOfMonth: "1" },
  });
  const type = form.watch("type");
  const categoryId = form.watch("categoryId");

  const filtered = useMemo(() => categories.filter((c) => c.kind === type), [categories, type]);

  const onValid = (values: RecurringInput) => {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("name", values.name);
      fd.set("type", values.type);
      fd.set("categoryId", values.categoryId);
      fd.set("amount", values.amount);
      fd.set("dayOfMonth", values.dayOfMonth ?? "1");
      try {
        const res = await createRecurringRule(fd);
        if (res.ok) {
          toast.success("ตั้งค่าใช้จ่ายประจำแล้ว");
          form.reset({ name: "", type: "expense", categoryId: "", amount: "", dayOfMonth: "1" });
          setOpen(false);
          return;
        }
        if ("fieldErrors" in res && res.fieldErrors) {
          for (const [k, v] of Object.entries(res.fieldErrors)) {
            form.setError(k as keyof RecurringInput, { message: v });
          }
        }
        if ("error" in res) toast.error(res.error);
      } catch {
        toast.error("บันทึกไม่สำเร็จ ลองอีกครั้ง — ข้อมูลที่กรอกยังอยู่");
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) form.reset({ name: "", type: "expense", categoryId: "", amount: "", dayOfMonth: "1" });
      }}
    >
      <DialogTrigger asChild>
        <Button className="bg-brand text-brand-foreground hover:bg-brand/90">
          <Plus className="mr-1 h-4 w-4" /> เพิ่มรายการประจำ
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>เพิ่มค่าใช้จ่ายประจำ</DialogTitle>
          <DialogDescription>เช่น ค่าเช่า 3,000/เดือน — ระบบจะลงให้อัตโนมัติทุกเดือน</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onValid)} className="space-y-4">
          {/* ประเภท */}
          <div className="space-y-1.5">
            <Label>ประเภท</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  form.setValue("type", "expense");
                  form.setValue("categoryId", "");
                }}
                className={cn(
                  "h-11 rounded-lg border-2 text-sm font-semibold",
                  type === "expense" ? "border-expense bg-expense-soft text-expense" : "border-border text-muted-foreground",
                )}
              >
                รายจ่าย
              </button>
              <button
                type="button"
                onClick={() => {
                  form.setValue("type", "income");
                  form.setValue("categoryId", "");
                }}
                className={cn(
                  "h-11 rounded-lg border-2 text-sm font-semibold",
                  type === "income" ? "border-income bg-income-soft text-income" : "border-border text-muted-foreground",
                )}
              >
                รายรับ
              </button>
            </div>
          </div>

          {/* ชื่อ */}
          <div className="space-y-1.5">
            <Label htmlFor="rname">ชื่อรายการ</Label>
            <Input
              id="rname"
              placeholder="เช่น ค่าเช่าร้าน"
              className="h-11"
              aria-invalid={!!form.formState.errors.name}
              {...form.register("name")}
            />
            {form.formState.errors.name ? (
              <p className="text-[0.8rem] font-medium text-destructive">{form.formState.errors.name.message}</p>
            ) : null}
          </div>

          {/* จำนวนเงิน */}
          <div className="space-y-1.5">
            <Label htmlFor="ramount">จำนวนเงินต่อเดือน (บาท)</Label>
            <Input
              id="ramount"
              inputMode="decimal"
              placeholder="0"
              className="h-12 text-lg font-semibold tabular-nums"
              aria-invalid={!!form.formState.errors.amount}
              {...form.register("amount")}
            />
            {form.formState.errors.amount ? (
              <p className="text-[0.8rem] font-medium text-destructive">{form.formState.errors.amount.message}</p>
            ) : null}
          </div>

          {/* หมวด */}
          <div className="space-y-1.5">
            <Label htmlFor="rcat">หมวด</Label>
            <Select value={categoryId} onValueChange={(v) => form.setValue("categoryId", v)}>
              <SelectTrigger id="rcat" className="h-11" aria-invalid={!!form.formState.errors.categoryId}>
                <SelectValue placeholder="เลือกหมวด" />
              </SelectTrigger>
              <SelectContent>
                {filtered.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    ยังไม่มีหมวด{type === "income" ? "รายรับ" : "รายจ่าย"} — เพิ่มที่ &quot;จัดการหมวด&quot;
                  </div>
                ) : (
                  filtered.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {form.formState.errors.categoryId ? (
              <p className="text-[0.8rem] font-medium text-destructive">{form.formState.errors.categoryId.message}</p>
            ) : null}
          </div>

          {/* วันที่ของเดือน */}
          <div className="space-y-1.5">
            <Label htmlFor="rday">ลงรายการทุกวันที่ (1–28)</Label>
            <Input
              id="rday"
              inputMode="numeric"
              placeholder="1"
              className="h-11 tabular-nums"
              aria-invalid={!!form.formState.errors.dayOfMonth}
              {...form.register("dayOfMonth")}
            />
            {form.formState.errors.dayOfMonth ? (
              <p className="text-[0.8rem] font-medium text-destructive">{form.formState.errors.dayOfMonth.message}</p>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              ยกเลิก
            </Button>
            <Button type="submit" className="bg-brand text-brand-foreground hover:bg-brand/90" disabled={pending}>
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              บันทึก
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * ตัวเลือกเดือนของหน้าค่าใช้จ่ายประจำ — ดู/พรีวิวเดือนไหนก็ได้ (เขียนลง ?m= ใน URL).
 * ใช้ recentMonths() จากฝั่ง server ส่ง months เข้ามา. เลือกแล้ว navigate ทันที.
 */
export function RecurringMonthSelect({
  value,
  months,
}: {
  value: string;
  months: MonthOption[];
}) {
  const router = useRouter();
  return (
    <Select value={value} onValueChange={(v) => router.push(`/recurring?m=${v}`)}>
      <SelectTrigger className="h-10 w-full" aria-label="เลือกเดือนที่ต้องการดู">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {months.map((m) => (
          <SelectItem key={m.value} value={m.value}>
            {m.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * ปุ่ม "สร้างรายการประจำ (N)" ของเดือนที่กำลังดู — โชว์จำนวนที่ "จะถูกสร้าง" (pending)
 * และสร้างให้เมื่อกด. Idempotent: กดซ้ำจะไม่สร้างซ้ำ (action เช็คต่อ rule+เดือน).
 * pending = 0 → ปุ่มจาง + ข้อความว่าครบแล้ว เพื่อไม่ให้ผู้ใช้สับสน.
 */
export function GenerateRecurringButton({
  monthKey,
  monthLabel,
  pendingCount,
}: {
  monthKey: string;
  monthLabel: string;
  pendingCount: number;
}) {
  const [pending, startTransition] = useTransition();
  const nothingToDo = pendingCount === 0;

  function onGenerate() {
    startTransition(async () => {
      try {
        const res = await runRecurringForMonth(monthKey);
        if (res.ok) {
          if (res.created > 0) {
            toast.success(`ลงรายการประจำของ ${monthLabel} ให้แล้ว ${res.created} รายการ`);
          } else {
            toast.success(`รายการประจำของ ${monthLabel} ครบแล้ว ไม่มีรายการใหม่ต้องสร้าง`);
          }
          return;
        }
        toast.error(res.error);
      } catch {
        toast.error("สร้างไม่สำเร็จ ลองอีกครั้ง");
      }
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="h-11 w-full"
      onClick={onGenerate}
      disabled={pending || nothingToDo}
    >
      {pending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <CalendarCheck className="mr-2 h-4 w-4" />
      )}
      {nothingToDo
        ? `รายการประจำของ ${monthLabel} ครบแล้ว`
        : `สร้างรายการประจำ (${pendingCount})`}
    </Button>
  );
}
