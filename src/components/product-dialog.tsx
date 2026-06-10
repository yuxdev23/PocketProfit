"use client";

import { useMemo, useState, useTransition } from "react";
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
import { cn } from "@/lib/utils";
import { productSchema, type ProductInput } from "@/lib/validation";
import { createProduct, updateProduct } from "@/lib/actions/products";
import { bahtToSatang } from "@/lib/money";
import { marginPct } from "@/lib/calc";

export type ProductInitial = {
  id: string;
  name: string;
  cost: string;
  price: string;
  lowMarginThreshold: string;
};

export function ProductDialog({
  mode,
  initial,
  trigger,
}: {
  mode: "create" | "edit";
  initial?: ProductInitial;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const form = useForm<ProductInput>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: initial?.name ?? "",
      cost: initial?.cost ?? "",
      price: initial?.price ?? "",
      lowMarginThreshold: initial?.lowMarginThreshold ?? "20",
    },
  });

  const cost = form.watch("cost");
  const price = form.watch("price");

  // margin สด (DoD-5 "แสดงทันที")
  const preview = useMemo(() => {
    const c = bahtToSatang(cost);
    const p = bahtToSatang(price);
    if (!Number.isFinite(c) || !Number.isFinite(p) || p <= 0) return null;
    return { pct: marginPct(c, p), belowCost: p < c };
  }, [cost, price]);

  const onValid = (values: ProductInput) => {
    startTransition(async () => {
      const fd = new FormData();
      if (mode === "edit" && initial) fd.set("id", initial.id);
      fd.set("name", values.name);
      fd.set("cost", values.cost);
      fd.set("price", values.price);
      fd.set("lowMarginThreshold", values.lowMarginThreshold ?? "20");
      try {
        const res = mode === "create" ? await createProduct(fd) : await updateProduct(fd);
        if (res.ok) {
          toast.success(mode === "create" ? "เพิ่มสินค้าแล้ว" : "แก้ไขสินค้าแล้ว");
          setOpen(false);
          if (mode === "create") form.reset({ name: "", cost: "", price: "", lowMarginThreshold: "20" });
          return;
        }
        if ("fieldErrors" in res && res.fieldErrors) {
          for (const [k, v] of Object.entries(res.fieldErrors)) {
            form.setError(k as keyof ProductInput, { message: v });
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
        if (o)
          form.reset({
            name: initial?.name ?? "",
            cost: initial?.cost ?? "",
            price: initial?.price ?? "",
            lowMarginThreshold: initial?.lowMarginThreshold ?? "20",
          });
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "เพิ่มสินค้า" : "แก้ไขสินค้า"}</DialogTitle>
          <DialogDescription>กรอกต้นทุนและราคาขายเพื่อคำนวณกำไรขั้นต้น %</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onValid)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="p-name">ชื่อสินค้า</Label>
            <Input
              id="p-name"
              placeholder="เช่น มาม่าซองใหญ่"
              className="h-11"
              aria-invalid={!!form.formState.errors.name}
              {...form.register("name")}
            />
            {form.formState.errors.name ? (
              <p className="text-[0.8rem] font-medium text-destructive">{form.formState.errors.name.message}</p>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="p-cost">ต้นทุน (บาท)</Label>
              <Input
                id="p-cost"
                inputMode="decimal"
                placeholder="3"
                className="h-11 tabular-nums"
                aria-invalid={!!form.formState.errors.cost}
                {...form.register("cost")}
              />
              {form.formState.errors.cost ? (
                <p className="text-[0.8rem] font-medium text-destructive">{form.formState.errors.cost.message}</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-price">ราคาขาย (บาท)</Label>
              <Input
                id="p-price"
                inputMode="decimal"
                placeholder="6"
                className="h-11 tabular-nums"
                aria-invalid={!!form.formState.errors.price}
                {...form.register("price")}
              />
              {form.formState.errors.price ? (
                <p className="text-[0.8rem] font-medium text-destructive">{form.formState.errors.price.message}</p>
              ) : null}
            </div>
          </div>

          {/* margin สด */}
          {preview ? (
            <div
              className={cn(
                "flex items-center justify-between rounded-lg p-3 text-sm",
                preview.belowCost ? "bg-expense-soft" : "bg-income-soft",
              )}
            >
              <span className={cn("font-medium", preview.belowCost ? "text-expense" : "text-income")}>
                อัตรากำไรขั้นต้น
              </span>
              <span className={cn("text-xl font-extrabold tabular-nums", preview.belowCost ? "text-expense" : "text-income")}>
                {preview.pct}%
              </span>
            </div>
          ) : null}
          {preview?.belowCost ? (
            <p className="text-[0.8rem] font-medium text-expense">ราคาขายต่ำกว่าต้นทุน — ขายแล้วขาดทุน</p>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="p-threshold">เตือนเมื่อกำไรขั้นต้นต่ำกว่า (%)</Label>
            <Input
              id="p-threshold"
              inputMode="numeric"
              placeholder="20"
              className="h-11 tabular-nums"
              aria-invalid={!!form.formState.errors.lowMarginThreshold}
              {...form.register("lowMarginThreshold")}
            />
            {form.formState.errors.lowMarginThreshold ? (
              <p className="text-[0.8rem] font-medium text-destructive">
                {form.formState.errors.lowMarginThreshold.message}
              </p>
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
