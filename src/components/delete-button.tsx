"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

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
import type { ActionResult } from "@/lib/actions/types";

/** ปุ่มลบทั่วไป + ยืนยัน (AlertDialog). action รับ id -> ActionResult. */
export function DeleteButton({
  id,
  action,
  title,
  description,
  successMessage = "ลบแล้ว",
  label,
}: {
  id: string;
  action: (id: string) => Promise<ActionResult>;
  title: string;
  description: string;
  successMessage?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function onConfirm() {
    startTransition(async () => {
      const res = await action(id);
      if (res.ok) toast.success(successMessage);
      else if ("error" in res) toast.error(res.error);
      setOpen(false);
    });
  }

  return (
    <>
      {label ? (
        <Button variant="ghost" size="sm" className="h-8 text-expense" onClick={() => setOpen(true)}>
          <Trash2 className="mr-1 h-4 w-4" /> {label}
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-expense"
          onClick={() => setOpen(true)}
          aria-label="ลบ"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={pending}
              onClick={(e) => {
                e.preventDefault();
                onConfirm();
              }}
            >
              ลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
