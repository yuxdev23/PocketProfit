"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Target } from "lucide-react";

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
import { goalSchema, type GoalInput } from "@/lib/validation";
import { setGoal } from "@/lib/actions/goals";

export function SetGoalDialog({
  month,
  incomeTargetBaht,
  expenseTargetBaht,
  triggerLabel,
}: {
  month: string;
  incomeTargetBaht: string;
  expenseTargetBaht: string;
  triggerLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const form = useForm<GoalInput>({
    resolver: zodResolver(goalSchema),
    defaultValues: { incomeTarget: incomeTargetBaht, expenseTarget: expenseTargetBaht },
  });

  const onValid = (values: GoalInput) => {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("month", month);
      fd.set("incomeTarget", values.incomeTarget);
      fd.set("expenseTarget", values.expenseTarget);
      try {
        const res = await setGoal(fd);
        if (res.ok) {
          toast.success("ตั้งเป้าเรียบร้อย");
          setOpen(false);
          return;
        }
        if ("fieldErrors" in res && res.fieldErrors) {
          for (const [k, v] of Object.entries(res.fieldErrors)) {
            form.setError(k as keyof GoalInput, { message: v });
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
        if (o) form.reset({ incomeTarget: incomeTargetBaht, expenseTarget: expenseTargetBaht });
      }}
    >
      <DialogTrigger asChild>
        <Button className="bg-brand text-brand-foreground hover:bg-brand/90">
          <Target className="mr-1.5 h-4 w-4" /> {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>ตั้งเป้าเดือนนี้</DialogTitle>
          <DialogDescription>กำหนดเป้ารายได้และเพดานรายจ่ายต่อเดือน</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onValid)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="incomeTarget">เป้ารายได้ต่อเดือน (บาท)</Label>
            <Input
              id="incomeTarget"
              inputMode="decimal"
              placeholder="20000"
              className="h-12 text-lg font-semibold tabular-nums"
              aria-invalid={!!form.formState.errors.incomeTarget}
              {...form.register("incomeTarget")}
            />
            {form.formState.errors.incomeTarget ? (
              <p className="text-[0.8rem] font-medium text-destructive">
                {form.formState.errors.incomeTarget.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="expenseTarget">เพดานรายจ่ายต่อเดือน (บาท)</Label>
            <Input
              id="expenseTarget"
              inputMode="decimal"
              placeholder="15000"
              className="h-12 text-lg font-semibold tabular-nums"
              aria-invalid={!!form.formState.errors.expenseTarget}
              {...form.register("expenseTarget")}
            />
            {form.formState.errors.expenseTarget ? (
              <p className="text-[0.8rem] font-medium text-destructive">
                {form.formState.errors.expenseTarget.message}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              ยกเลิก
            </Button>
            <Button type="submit" className="bg-brand text-brand-foreground hover:bg-brand/90" disabled={pending}>
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              บันทึกเป้า
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
