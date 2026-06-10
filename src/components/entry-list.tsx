"use client";

/**
 * EntryList / EntryRow (F1 ลิสต์, F7, EDGE-1) — แถวรายการ + แก้/ประวัติ/ลบ/ดูรูป.
 * รับข้อมูลเป็น plain object (EntryView) เท่านั้น (ไม่ส่ง Prisma type ข้าม boundary).
 */

import { useState, useTransition } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { toast } from "sonner";
import { Pencil, History, Trash2, Receipt, Repeat, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { formatThaiDate } from "@/lib/dates";
import { parseReceiptPaths } from "@/lib/receipts";
import { deleteEntry } from "@/lib/actions/entries";
import { EditEntryDialog, type EditEntryInitial } from "@/components/edit-entry-dialog";
import { HistoryDialog } from "@/components/history-dialog";
import type { CategoryOption } from "@/components/entry-form-fields";

export type EntryView = {
  id: string;
  type: "income" | "expense";
  categoryName: string;
  categoryId: string | null;
  amountSatang: number;
  occurredAtISO: string;
  note: string | null;
  receiptPaths: string | null;
  vatRate: number;
  vatAmountSatang: number;
  revisionCount: number;
  dateKey: string; // YYYY-MM-DD (เวลาไทย) สำหรับ prefill ฟอร์มแก้ไข
  /** F6: id ของรายการประจำต้นทาง (ถ้ารายการนี้ถูกระบบสร้างจากค่าใช้จ่ายประจำ) — optional. */
  recurringRuleId?: string | null;
};

/**
 * รายการนี้มาจาก "ค่าใช้จ่ายประจำ" หรือไม่ (F6) — ใช้โชว์ป้าย "ประจำ".
 * อิง recurringRuleId ก่อน (สัญญาณตรง); ถ้ายังไม่ถูก serialize มา ใช้โน้ตท้าย "(รายการประจำ)"
 * ที่ระบบเติมตอน auto-generate เป็น fallback ให้ป้ายขึ้นได้ทันที.
 */
function isRecurringEntry(entry: EntryView): boolean {
  if (entry.recurringRuleId) return true;
  return !!entry.note && entry.note.trimEnd().endsWith("(รายการประจำ)");
}

export function EntryList({
  entries,
  categories,
  todayKey,
  showDate = true,
}: {
  entries: EntryView[];
  categories: CategoryOption[];
  todayKey: string;
  showDate?: boolean;
}) {
  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-card">
      {entries.map((e) => (
        <EntryRow key={e.id} entry={e} categories={categories} todayKey={todayKey} showDate={showDate} />
      ))}
    </ul>
  );
}

function EntryRow({
  entry,
  categories,
  todayKey,
  showDate,
}: {
  entry: EntryView;
  categories: CategoryOption[];
  todayKey: string;
  showDate: boolean;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [thumbBroken, setThumbBroken] = useState(false); // รูปแรกในแถวโหลดไม่ได้ → โชว์ placeholder แทน
  const [brokenImgs, setBrokenImgs] = useState<Set<string>>(() => new Set()); // รูปในรายละเอียดที่โหลดไม่ได้
  const [pending, startTransition] = useTransition();

  const isIncome = entry.type === "income";
  const receipts = parseReceiptPaths(entry.receiptPaths);

  // บรรทัดล่าง (วันที่ · โน้ต) — ใช้แสดงผลในแถว
  const dateText = showDate ? formatThaiDate(new Date(entry.occurredAtISO)) : "";
  const metaText = [dateText, entry.note ?? ""].filter(Boolean).join(" · ");
  // title ของทั้งแถว — hover เห็นข้อความเต็มเมื่อถูกตัด … (คลิกเพื่อดูเต็มใน modal)
  const detailHint = [entry.categoryName, metaText].filter(Boolean).join(" · ");

  const initial: EditEntryInitial = {
    id: entry.id,
    type: entry.type,
    amount: String(entry.amountSatang / 100),
    categoryId: entry.categoryId ?? "",
    date: entry.dateKey,
    note: entry.note ?? "",
    vat7: entry.vatRate === 7,
    receiptPaths: entry.receiptPaths,
  };

  function onDelete() {
    startTransition(async () => {
      const res = await deleteEntry(entry.id);
      if (res.ok) toast.success("ลบรายการแล้ว");
      else if ("error" in res) toast.error(res.error);
      setConfirmDelete(false);
    });
  }

  return (
    <li className="relative flex items-center gap-3 p-3 transition-colors hover:bg-accent/30">
      {/* คลิกทั้งแถว → เปิด modal รายละเอียดเต็ม (เห็นข้อมูลครบบนจอเล็ก).
          ปุ่ม actions มี z สูงกว่า overlay นี้ จึงยังกดแยกได้ตามปกติ */}
      <button
        type="button"
        onClick={() => setDetailOpen(true)}
        aria-label={`ดูรายละเอียด ${entry.categoryName}`}
        title={detailHint}
        className="absolute inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      />

      {/* รูปสลิป thumbnail (รูปแรก + ป้ายจำนวนถ้ามีหลายรูป) / placeholder (รวมกรณีรูปโหลดไม่ได้) */}
      {receipts.length > 0 && !thumbBroken ? (
        <div className="pointer-events-none relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={receipts[0]}
            alt="ใบเสร็จ"
            className="h-full w-full object-cover"
            onError={() => setThumbBroken(true)}
          />
          {receipts.length > 1 ? (
            <span className="absolute bottom-0 right-0 rounded-tl-md bg-foreground/75 px-1 text-[10px] font-semibold leading-tight text-background">
              +{receipts.length - 1}
            </span>
          ) : null}
        </div>
      ) : (
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg",
            isIncome ? "bg-income-soft text-income" : "bg-expense-soft text-expense",
          )}
        >
          <Receipt className="h-5 w-5" />
        </div>
      )}

      {/* รายละเอียด */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-medium text-foreground">{entry.categoryName}</span>
          {isRecurringEntry(entry) ? (
            <Badge
              variant="secondary"
              className="h-5 shrink-0 gap-0.5 bg-brand/15 px-1.5 text-[10px] text-brand"
            >
              <Repeat className="h-3 w-3" /> ประจำ
            </Badge>
          ) : null}
          {entry.vatRate > 0 ? (
            <Badge variant="outline" className="h-5 shrink-0 px-1.5 text-[10px]">
              VAT {entry.vatRate}%
            </Badge>
          ) : null}
        </div>
        <div className="truncate text-xs text-muted-foreground">{metaText}</div>
      </div>

      {/* จำนวนเงิน */}
      <div className={cn("shrink-0 text-right font-bold tabular-nums", isIncome ? "text-income" : "text-expense")}>
        {isIncome ? "+" : "−"}
        {formatMoney(entry.amountSatang)}
      </div>

      {/* actions — z สูงกว่า overlay คลิกแถว จึงกดได้แยกจากการเปิด modal */}
      <div className="relative z-10 flex shrink-0 items-center">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditOpen(true)} aria-label="แก้ไข">
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8"
          onClick={() => setHistoryOpen(true)}
          aria-label={
            entry.revisionCount > 0
              ? `ประวัติการแก้ไข — แก้ไขแล้ว ${entry.revisionCount} ครั้ง`
              : "ประวัติการแก้ไข"
          }
          title={
            entry.revisionCount > 0
              ? `แก้ไขแล้ว ${entry.revisionCount} ครั้ง`
              : "ประวัติการแก้ไข"
          }
        >
          <History className="h-4 w-4" />
          {/* จุดแดงแจ้งว่ามีประวัติการแก้ไข (แทนป้าย "แก้ไข N") */}
          {entry.revisionCount > 0 ? (
            <span
              aria-hidden
              className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-expense ring-2 ring-card"
            />
          ) : null}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-expense"
          onClick={() => setConfirmDelete(true)}
          aria-label="ลบ"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* รายละเอียดเต็มของรายการ (เปิดจากการคลิกแถว) — เห็นข้อมูลครบถ้วนบนจอเล็ก */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2 pr-6 text-left">
              <span className="break-words">{entry.categoryName}</span>
              {isRecurringEntry(entry) ? (
                <Badge variant="secondary" className="gap-0.5 bg-brand/15 text-brand">
                  <Repeat className="h-3 w-3" /> ประจำ
                </Badge>
              ) : null}
            </DialogTitle>
            <DialogDescription>
              {isIncome ? "รายรับ" : "รายจ่าย"} · {formatThaiDate(new Date(entry.occurredAtISO))}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {/* ยอดเงิน */}
            <div className="rounded-xl border border-border bg-muted/30 p-4 text-center">
              <p
                className={cn(
                  "text-2xl font-bold tabular-nums",
                  isIncome ? "text-income" : "text-expense",
                )}
              >
                {isIncome ? "+" : "−"}
                {formatMoney(entry.amountSatang)}
              </p>
            </div>

            {/* ฟิลด์ย่อย */}
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="shrink-0 text-muted-foreground">วันที่</dt>
                <dd className="text-right font-medium text-foreground">
                  {formatThaiDate(new Date(entry.occurredAtISO))}
                </dd>
              </div>
              {entry.vatRate > 0 ? (
                <div className="flex justify-between gap-3">
                  <dt className="shrink-0 text-muted-foreground">VAT {entry.vatRate}%</dt>
                  <dd className="text-right font-medium text-foreground">
                    {formatMoney(entry.vatAmountSatang)}
                  </dd>
                </div>
              ) : null}
              {entry.revisionCount > 0 ? (
                <div className="flex justify-between gap-3">
                  <dt className="shrink-0 text-muted-foreground">ประวัติ</dt>
                  <dd className="text-right font-medium text-foreground">
                    แก้ไขแล้ว {entry.revisionCount} ครั้ง
                  </dd>
                </div>
              ) : null}
            </dl>

            {/* โน้ตเต็ม (ไม่ตัดข้อความ) */}
            {entry.note ? (
              <div className="rounded-lg border border-border bg-card p-3">
                <p className="mb-1 text-xs text-muted-foreground">โน้ต</p>
                <p className="whitespace-pre-wrap break-words text-sm text-foreground">
                  {entry.note}
                </p>
              </div>
            ) : null}

            {/* ใบเสร็จที่แนบ — thumbnail เรียงเหมือนหน้าสร้างรายการ, คลิกดูเต็มขนาด */}
            {receipts.length > 0 ? (
              <div>
                <p className="mb-1 text-xs text-muted-foreground">
                  ใบเสร็จที่แนบ{receipts.length > 1 ? ` (${receipts.length} รูป)` : ""}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {receipts.map((p) =>
                    brokenImgs.has(p) ? (
                      <div
                        key={p}
                        className="flex h-24 w-full items-center justify-center rounded-lg border border-dashed border-border px-1 text-center text-[10px] leading-tight text-muted-foreground"
                      >
                        รูปไม่พร้อมใช้งาน
                      </div>
                    ) : (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setLightbox(p)}
                        aria-label="ดูใบเสร็จเต็มขนาด"
                        className="group relative overflow-hidden rounded-lg border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={p}
                          alt="ใบเสร็จ"
                          className="h-24 w-full object-cover transition-transform duration-200 group-hover:scale-105"
                          onError={() => setBrokenImgs((s) => new Set(s).add(p))}
                        />
                      </button>
                    ),
                  )}
                </div>
              </div>
            ) : null}
          </div>

          {/* ปุ่มจัดการ — อยู่แถวเดียวกันและกึ่งกลางเสมอ ทุกขนาดจอ (ไม่ stack บนมือถือ) */}
          <div className="flex flex-row flex-nowrap items-center justify-center gap-2 pt-2">
            {entry.revisionCount > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDetailOpen(false);
                  setHistoryOpen(true);
                }}
              >
                <History className="mr-1.5 h-4 w-4" /> ประวัติ
              </Button>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDetailOpen(false);
                setEditOpen(true);
              }}
            >
              <Pencil className="mr-1.5 h-4 w-4" /> แก้ไข
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-expense hover:bg-expense-soft hover:text-expense"
              onClick={() => {
                setDetailOpen(false);
                setConfirmDelete(true);
              }}
            >
              <Trash2 className="mr-1.5 h-4 w-4" /> ลบ
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Lightbox ดูใบเสร็จเต็มขนาด — ไม่เกินขนาดจอ; คลิกพื้นหลัง / Esc / ปุ่ม X เพื่อปิด */}
      <DialogPrimitive.Root open={!!lightbox} onOpenChange={(o) => !o && setLightbox(null)}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-black/85 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content
            onClick={() => setLightbox(null)}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 focus:outline-none"
          >
            <DialogPrimitive.Title className="sr-only">ดูใบเสร็จเต็มขนาด</DialogPrimitive.Title>
            {lightbox ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={lightbox}
                alt="ใบเสร็จเต็มขนาด"
                onClick={(e) => e.stopPropagation()}
                className="max-h-[92vh] max-w-[96vw] rounded-lg object-contain shadow-2xl"
              />
            ) : null}
            <DialogPrimitive.Close
              aria-label="ปิด"
              className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <X className="h-5 w-5" />
            </DialogPrimitive.Close>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <EditEntryDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        categories={categories}
        todayKey={todayKey}
        initial={initial}
      />
      <HistoryDialog open={historyOpen} onOpenChange={setHistoryOpen} entryId={entry.id} />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ลบรายการนี้?</AlertDialogTitle>
            <AlertDialogDescription>ลบแล้วยอดสรุปจะถูกคำนวณใหม่ ยืนยันหรือไม่?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={pending}
              onClick={(e) => {
                e.preventDefault();
                onDelete();
              }}
            >
              ลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}
