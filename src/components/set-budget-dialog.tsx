"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

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
import { budgetSchema } from "@/lib/validation";
import { setBudget } from "@/lib/actions/budgets";

type FormValues = { categoryId: string; budget: string };

export function SetBudgetDialog({
  categoryId,
  categoryName,
  currentBudgetBaht,
  trigger,
}: {
  categoryId: string;
  categoryName: string;
  currentBudgetBaht: string;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const form = useForm<FormValues>({
    resolver: zodResolver(budgetSchema),
    defaultValues: { categoryId, budget: currentBudgetBaht },
  });

  const onValid = (values: FormValues) => {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("categoryId", values.categoryId);
      fd.set("budget", values.budget);
      try {
        const res = await setBudget(fd);
        if (res.ok) {
          toast.success("ตั้งงบเรียบร้อย");
          setOpen(false);
          return;
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
        if (o) form.reset({ categoryId, budget: currentBudgetBaht });
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>ตั้งงบ — {categoryName}</DialogTitle>
          <DialogDescription>กำหนดงบประมาณต่อเดือนของหมวดนี้</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onValid)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="budget">งบประมาณต่อเดือน (บาท)</Label>
            <Input
              id="budget"
              inputMode="decimal"
              autoFocus
              placeholder="0"
              className="h-12 text-lg font-semibold tabular-nums"
              aria-invalid={!!form.formState.errors.budget}
              {...form.register("budget")}
            />
            {form.formState.errors.budget ? (
              <p className="text-[0.8rem] font-medium text-destructive">
                {form.formState.errors.budget.message}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              ยกเลิก
            </Button>
            <Button type="submit" className="bg-brand text-brand-foreground hover:bg-brand/90" disabled={pending}>
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              บันทึกงบ
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
