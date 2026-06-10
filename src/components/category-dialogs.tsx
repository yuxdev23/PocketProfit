"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Plus, Pencil } from "lucide-react";

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
import { categorySchema, type CategoryInput } from "@/lib/validation";
import { createCategory, renameCategory } from "@/lib/actions/categories";

export function AddCategoryDialog() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const form = useForm<CategoryInput>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: "", kind: "expense" },
  });
  const kind = form.watch("kind");

  const onValid = (values: CategoryInput) => {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("name", values.name);
      fd.set("kind", values.kind);
      try {
        const res = await createCategory(fd);
        if (res.ok) {
          toast.success("เพิ่มหมวดแล้ว");
          form.reset({ name: "", kind: values.kind });
          setOpen(false);
          return;
        }
        if ("fieldErrors" in res && res.fieldErrors) {
          for (const [k, v] of Object.entries(res.fieldErrors)) {
            form.setError(k as keyof CategoryInput, { message: v });
          }
        }
        if ("error" in res) toast.error(res.error);
      } catch {
        toast.error("บันทึกไม่สำเร็จ ลองอีกครั้ง — ข้อมูลที่กรอกยังอยู่");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) form.reset({ name: "", kind: "expense" }); }}>
      <DialogTrigger asChild>
        <Button className="bg-brand text-brand-foreground hover:bg-brand/90">
          <Plus className="mr-1 h-4 w-4" /> เพิ่มหมวด
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>เพิ่มหมวดใหม่</DialogTitle>
          <DialogDescription>สร้างหมวดของคุณเองเพื่อใช้ตอนบันทึกรายการ</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onValid)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>ประเภท</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => form.setValue("kind", "expense")}
                className={cn(
                  "h-11 rounded-lg border-2 text-sm font-semibold",
                  kind === "expense" ? "border-expense bg-expense-soft text-expense" : "border-border text-muted-foreground",
                )}
              >
                รายจ่าย
              </button>
              <button
                type="button"
                onClick={() => form.setValue("kind", "income")}
                className={cn(
                  "h-11 rounded-lg border-2 text-sm font-semibold",
                  kind === "income" ? "border-income bg-income-soft text-income" : "border-border text-muted-foreground",
                )}
              >
                รายรับ
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-name">ชื่อหมวด</Label>
            <Input
              id="c-name"
              placeholder="เช่น ค่าการตลาด"
              className="h-11"
              autoFocus
              aria-invalid={!!form.formState.errors.name}
              {...form.register("name")}
            />
            {form.formState.errors.name ? (
              <p className="text-[0.8rem] font-medium text-destructive">{form.formState.errors.name.message}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              ยกเลิก
            </Button>
            <Button type="submit" className="bg-brand text-brand-foreground hover:bg-brand/90" disabled={pending}>
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              เพิ่มหมวด
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RenameCategoryDialog({ id, currentName }: { id: string; currentName: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(currentName);
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", id);
      fd.set("name", name);
      try {
        const res = await renameCategory(fd);
        if (res.ok) {
          toast.success("แก้ชื่อหมวดแล้ว");
          setOpen(false);
          return;
        }
        if ("fieldErrors" in res && res.fieldErrors?.name) setError(res.fieldErrors.name);
        else if ("error" in res) {
          setError(res.error);
        }
      } catch {
        toast.error("บันทึกไม่สำเร็จ ลองอีกครั้ง");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) { setName(currentName); setError(null); } }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="แก้ชื่อ">
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>แก้ชื่อหมวด</DialogTitle>
          <DialogDescription>เปลี่ยนชื่อหมวด — รายการเดิมจะอัปเดตชื่อตามด้วย</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="rename">ชื่อหมวด</Label>
            <Input
              id="rename"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11"
              autoFocus
              aria-invalid={!!error}
            />
            {error ? <p className="text-[0.8rem] font-medium text-destructive">{error}</p> : null}
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
