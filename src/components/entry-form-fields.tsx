"use client";

/**
 * Shared field set + zod logic สำหรับฟอร์มบันทึก/แก้รายการ (F1, DoD-1, N3).
 * ใช้ react-hook-form + zodResolver (client) — validate ก่อน submit เสมอ.
 * ส่งออก hook ที่ประกอบ FormData + จัดการ confirm flow (EDGE-2/4) + save-failure.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Camera, ChevronDown, X, AlertCircle } from "lucide-react";

import { entrySchema, editEntrySchema, type EntryInput } from "@/lib/validation";
import { bahtToSatang } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** เหลือเฉพาะตัวเลข + จุดทศนิยมเดียว (ไม่เกิน 2 ตำแหน่ง) — ค่า "ดิบ" ที่เก็บในฟอร์ม/ส่ง server */
function sanitizeAmountInput(input: string): string {
  let s = input.replace(/[^\d.]/g, "");
  if (s.startsWith(".")) s = "0" + s;
  const dot = s.indexOf(".");
  if (dot !== -1) {
    s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, "");
    const [i, d = ""] = s.split(".");
    s = i + "." + d.slice(0, 2);
  }
  return s;
}

/** ใส่ comma คั่นหลักพันสำหรับ "แสดงผล" ในช่อง (คงจุด/ทศนิยมที่กำลังพิมพ์ไว้) */
function formatAmountDisplay(raw: string): string {
  if (!raw) return "";
  const [intRaw, decRaw] = raw.split(".");
  const intNum = intRaw.replace(/^0+(?=\d)/, "");
  const intFmt = intNum === "" ? "0" : Number(intNum).toLocaleString("en-US");
  return raw.includes(".") ? `${intFmt}.${decRaw ?? ""}` : intFmt;
}

export type CategoryOption = { id: string; name: string; kind: "income" | "expense" };

export type EntryFormValues = {
  type: "income" | "expense";
  amount: string;
  categoryId: string;
  date: string;
  note: string;
  vat7: boolean;
  reason: string;
};

export function useEntryForm(opts: {
  withReason: boolean;
  defaults: Partial<EntryFormValues>;
  todayKey: string;
}) {
  const schema = opts.withReason ? editEntrySchema : entrySchema;
  return useForm<EntryFormValues>({
    resolver: zodResolver(schema as typeof editEntrySchema),
    mode: "onSubmit",
    defaultValues: {
      type: opts.defaults.type ?? "expense",
      amount: opts.defaults.amount ?? "",
      categoryId: opts.defaults.categoryId ?? "",
      date: opts.defaults.date ?? opts.todayKey,
      note: opts.defaults.note ?? "",
      vat7: opts.defaults.vat7 ?? false,
      reason: opts.defaults.reason ?? "",
    },
  });
}

/** The actual visible fields. รับ form (จาก useEntryForm) + categories. */
export function EntryFields({
  form,
  categories,
  todayKey,
  withReason,
  receiptFiles,
  onReceiptFilesChange,
  existingReceiptPaths = [],
  onExistingReceiptPathsChange,
}: {
  form: ReturnType<typeof useEntryForm>;
  categories: CategoryOption[];
  todayKey: string;
  withReason: boolean;
  receiptFiles: File[];
  onReceiptFilesChange: (files: File[]) => void;
  existingReceiptPaths?: string[];
  onExistingReceiptPathsChange?: (paths: string[]) => void;
}) {
  const {
    register,
    setValue,
    watch,
    formState: { errors, dirtyFields },
  } = form;
  const type = watch("type");
  const amount = watch("amount");
  const vat7 = watch("vat7");
  const date = watch("date");
  const note = watch("note");
  // F7.3 (กระทบยอด): โหมดแก้ไข + แก้ตัวเลขช่อง "จำนวนเงิน" → เตือนให้ตรวจสลิปก่อนบันทึก
  const amountEdited = withReason && !!dirtyFields.amount;
  const fileRef = useRef<HTMLInputElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  // Progressive disclosure: ซ่อน วันที่ + หมายเหตุ ไว้หลังปุ่ม "ตัวเลือกเพิ่มเติม"
  // ให้ฟอร์มเริ่มต้นสั้น (ประเภท/จำนวน/หมวด พอแล้ว). เปิดอัตโนมัติถ้ามีค่าซ่อนอยู่
  // (เช่น โหมดแก้ไขที่ลงวันย้อนหลัง/มีโน้ต) เพื่อไม่ให้ผู้ใช้พลาดข้อมูล.
  const [showMore, setShowMore] = useState(false);
  useEffect(() => {
    if ((date && date !== todayKey) || (note && note.length > 0)) {
      setShowMore(true);
    }
    // ตั้งค่าครั้งแรกตอน mount ตามค่า prefill เท่านั้น
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(
    () => categories.filter((c) => c.kind === type),
    [categories, type],
  );

  // คำนวณ VAT สด (N3) — inclusive
  const vatPreview = useMemo(() => {
    if (!vat7) return null;
    const total = bahtToSatang(amount);
    if (!Number.isFinite(total) || total <= 0) return null;
    const vat = Math.round(total - total / 1.07);
    return { before: total - vat, vat, total };
  }, [vat7, amount]);

  // object URL ของรูปใหม่ (ยังไม่อัปโหลด) — สร้างตอน render, revoke เมื่อเปลี่ยน/unmount
  const filePreviews = useMemo(
    () => receiptFiles.map((f) => URL.createObjectURL(f)),
    [receiptFiles],
  );
  useEffect(() => () => filePreviews.forEach((u) => URL.revokeObjectURL(u)), [filePreviews]);

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    setFileError(null);
    const picked = Array.from(e.target.files ?? []);
    const valid: File[] = [];
    // จำกัดขนาด "รวมทุกรูปใหม่" ของรายการ กันชน body limit ของ server (ตั้งไว้ 50 MB)
    // → บันทึกได้จริง ไม่ค้าง; ถ้าเกินจะแจ้งชัดเจนแทนการรอเงียบ ๆ
    const MAX_TOTAL_BYTES = 45 * 1024 * 1024;
    let total = receiptFiles.reduce((s, f) => s + f.size, 0);
    for (const f of picked) {
      if (!f.type.startsWith("image/")) {
        setFileError("แนบได้เฉพาะไฟล์รูปภาพ");
        continue;
      }
      if (f.size > 5 * 1024 * 1024) {
        setFileError("บางรูปใหญ่เกินไป (ไม่เกิน 5 MB ต่อรูป)");
        continue;
      }
      if (total + f.size > MAX_TOTAL_BYTES) {
        setFileError("รูปทั้งหมดรวมกันใหญ่เกินไป (รวมไม่เกิน ~45 MB) — ลองลดจำนวนหรือบีบอัดรูปก่อน");
        break;
      }
      total += f.size;
      valid.push(f);
    }
    if (valid.length) onReceiptFilesChange([...receiptFiles, ...valid]);
    // เคลียร์ค่า input → เลือกไฟล์เดิมซ้ำได้ + กดเพิ่มหลายรอบได้
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="space-y-4">
      {/* 1) จำนวนเงิน — พระเอกของฟอร์ม: ใหญ่ กึ่งกลาง โทนอุ่น โฟกัสอัตโนมัติ */}
      <div className="space-y-1.5">
        <Label
          htmlFor="amount"
          className="block text-center text-sm font-medium text-muted-foreground"
        >
          จำนวนเงิน
        </Label>
        <div className="relative">
          <Controller
            control={form.control}
            name="amount"
            render={({ field }) => (
              <Input
                id="amount"
                inputMode="decimal"
                autoFocus
                placeholder="0.00"
                aria-label="จำนวนเงิน (บาท)"
                className="h-16 rounded-2xl border-brand/30 bg-brand/5 pr-16 text-center text-3xl font-bold tabular-nums focus-visible:bg-background"
                aria-invalid={!!errors.amount}
                ref={field.ref}
                name={field.name}
                onBlur={field.onBlur}
                // แสดงผลแบบมี comma/decimal ขณะพิมพ์ แต่เก็บค่า "ดิบ" (ไม่มี comma) ลงฟอร์ม
                value={formatAmountDisplay(field.value)}
                onChange={(e) => field.onChange(sanitizeAmountInput(e.target.value))}
              />
            )}
          />
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-base font-medium text-muted-foreground">
            บาท
          </span>
        </div>
        {errors.amount ? (
          <p className="text-center text-[0.8rem] font-medium text-destructive">
            {errors.amount.message}
          </p>
        ) : null}
      </div>

      {/* 2) ประเภท */}
      <div className="space-y-1.5">
        <Label>ประเภท</Label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setValue("type", "expense");
              setValue("categoryId", "");
            }}
            className={cn(
              "h-12 rounded-lg border-2 text-base font-semibold transition-colors",
              type === "expense"
                ? "border-expense bg-expense-soft text-expense"
                : "border-border text-muted-foreground",
            )}
            aria-pressed={type === "expense"}
          >
            รายจ่าย
          </button>
          <button
            type="button"
            onClick={() => {
              setValue("type", "income");
              setValue("categoryId", "");
            }}
            className={cn(
              "h-12 rounded-lg border-2 text-base font-semibold transition-colors",
              type === "income"
                ? "border-income bg-income-soft text-income"
                : "border-border text-muted-foreground",
            )}
            aria-pressed={type === "income"}
          >
            รายรับ
          </button>
        </div>
        {errors.type ? (
          <p className="text-[0.8rem] font-medium text-destructive">{errors.type.message}</p>
        ) : null}
      </div>

      {/* 3) หมวด */}
      <div className="space-y-1.5">
        <Label htmlFor="categoryId">หมวด</Label>
        <Select value={watch("categoryId")} onValueChange={(v) => setValue("categoryId", v, { shouldValidate: false })}>
          <SelectTrigger id="categoryId" className="h-12" aria-invalid={!!errors.categoryId}>
            <SelectValue placeholder="เลือกหมวด" />
          </SelectTrigger>
          <SelectContent>
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                ยังไม่มีหมวด{type === "income" ? "รายรับ" : "รายจ่าย"} — เพิ่มได้ที่ &quot;จัดการหมวด&quot;
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
        {errors.categoryId ? (
          <p className="text-[0.8rem] font-medium text-destructive">{errors.categoryId.message}</p>
        ) : null}
      </div>

      {/* 4) แนบรูปสลิป — หลายรูปได้ (F7) */}
      <div className="space-y-1.5">
        <Label className="block">แนบรูปสลิป/ใบเสร็จ (ไม่บังคับ)</Label>
        {/* F7.3 กระทบยอด: แก้จำนวนเงินในโหมดแก้ไข → เตือนให้ตรวจสลิปก่อนบันทึก */}
        {amountEdited ? (
          <p className="flex items-center gap-1 text-[0.8rem] font-medium text-warning">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            ตรวจสอบสลิปก่อนบันทึกรายการ
          </p>
        ) : null}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={handleFiles}
        />
        {existingReceiptPaths.length > 0 || receiptFiles.length > 0 ? (
          <div className="grid grid-cols-3 gap-2">
            {/* รูปเดิมที่แนบไว้แล้ว (โหมดแก้ไข) — ลบได้ทีละรูป */}
            {existingReceiptPaths.map((p) => (
              <div key={p} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p}
                  alt="รูปสลิปที่แนบ"
                  className="h-24 w-full rounded-lg border border-border object-cover"
                />
                <button
                  type="button"
                  onClick={() =>
                    onExistingReceiptPathsChange?.(existingReceiptPaths.filter((x) => x !== p))
                  }
                  className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-expense text-expense-foreground shadow"
                  aria-label="ลบรูป"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            {/* รูปใหม่ที่เพิ่งเลือก (ยังไม่อัปโหลด) */}
            {receiptFiles.map((f, i) => (
              <div key={`${f.name}-${f.size}-${f.lastModified}`} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={filePreviews[i]}
                  alt="รูปสลิปที่แนบ"
                  className="h-24 w-full rounded-lg border border-border object-cover"
                />
                <button
                  type="button"
                  onClick={() => onReceiptFilesChange(receiptFiles.filter((_, j) => j !== i))}
                  className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-expense text-expense-foreground shadow"
                  aria-label="ลบรูป"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            {/* เพิ่มรูปอีก */}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex h-24 w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border text-xs font-medium text-muted-foreground"
            >
              <Camera className="h-5 w-5" />
              เพิ่มรูป
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border text-sm font-medium text-muted-foreground"
          >
            <Camera className="h-5 w-5" />
            ถ่าย/แนบรูป
          </button>
        )}
        {fileError ? (
          <p className="text-[0.8rem] font-medium text-destructive">{fileError}</p>
        ) : null}
      </div>

      {/* 5) VAT 7% (N3) */}
      <div className="space-y-1.5 rounded-lg border border-border p-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="vat7" className="cursor-pointer">
            มี VAT 7%
          </Label>
          <Switch
            id="vat7"
            checked={vat7}
            onCheckedChange={(v) => setValue("vat7", v)}
          />
        </div>
        {vatPreview ? (
          <div className="flex justify-between gap-2 text-xs text-muted-foreground">
            <span>ก่อน VAT ฿{(vatPreview.before / 100).toLocaleString("th-TH", { maximumFractionDigits: 2 })}</span>
            <span>VAT ฿{(vatPreview.vat / 100).toLocaleString("th-TH", { maximumFractionDigits: 2 })}</span>
            <span className="font-medium text-foreground">
              รวม ฿{(vatPreview.total / 100).toLocaleString("th-TH", { maximumFractionDigits: 2 })}
            </span>
          </div>
        ) : null}
      </div>

      {/* เหตุผลการแก้ไข (EDGE-1) — โหมดแก้ไขเท่านั้น, บังคับกรอก จึงโชว์เสมอ */}
      {withReason ? (
        <div className="space-y-1.5">
          <Label htmlFor="reason">เหตุผลการแก้ไข</Label>
          <Input
            id="reason"
            placeholder="เช่น กรอกยอดผิด แก้ให้ตรงสลิป"
            className="h-11"
            aria-invalid={!!errors.reason}
            {...register("reason")}
          />
          {errors.reason ? (
            <p className="text-[0.8rem] font-medium text-destructive">{errors.reason.message}</p>
          ) : null}
        </div>
      ) : null}

      {/* ตัวเลือกเพิ่มเติม — ซ่อน วันที่ + หมายเหตุ ให้ฟอร์มเริ่มต้นสั้น */}
      <button
        type="button"
        onClick={() => {
          const willOpen = !showMore;
          setShowMore(willOpen);
          // เปิดแล้วเลื่อนหน้าจอลงไปโชว์เนื้อหาที่เพิ่งกาง (วันที่ / หมายเหตุ) ให้เห็นจนสุด
          if (willOpen) {
            requestAnimationFrame(() =>
              moreRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }),
            );
          }
        }}
        aria-expanded={showMore}
        className="flex w-full items-center justify-between rounded-lg px-1 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        ตัวเลือกเพิ่มเติม (วันที่ / หมายเหตุ)
        <ChevronDown className={cn("h-4 w-4 transition-transform", showMore && "rotate-180")} />
      </button>

      {showMore ? (
        // scroll-mb-28 = เผื่อพื้นที่ใต้กล่องเท่าความสูง footer (sticky) เวลา scrollIntoView จะได้ไม่โดนบัง
        <div ref={moreRef} className="scroll-mb-28 space-y-4 rounded-lg bg-muted/40 p-3">
          {/* วันที่ */}
          <div className="space-y-1.5">
            <Label htmlFor="date">วันที่</Label>
            <Input
              id="date"
              type="date"
              max={todayKey}
              className="h-12"
              aria-invalid={!!errors.date}
              {...register("date")}
            />
            {errors.date ? (
              <p className="text-[0.8rem] font-medium text-destructive">{errors.date.message}</p>
            ) : null}
          </div>

          {/* หมายเหตุ */}
          <div className="space-y-1.5">
            <Label htmlFor="note">หมายเหตุ (ไม่บังคับ)</Label>
            <Input id="note" placeholder="เช่น ของเข้าร้านต้นเดือน" className="h-11" {...register("note")} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** ประกอบ EntryFormValues + ไฟล์ -> FormData (ส่งให้ server action). */
export function buildEntryFormData(
  values: EntryFormValues,
  receiptFiles: File[],
  keepReceiptPaths: string[],
  extra: Record<string, string> = {},
): FormData {
  const fd = new FormData();
  fd.set("type", values.type);
  fd.set("amount", values.amount);
  fd.set("categoryId", values.categoryId);
  fd.set("date", values.date);
  fd.set("note", values.note ?? "");
  fd.set("vat7", values.vat7 ? "true" : "false");
  if (values.reason) fd.set("reason", values.reason);
  for (const f of receiptFiles) fd.append("receipt", f); // หลายรูป → append ซ้ำ key เดิม
  fd.set("keepReceipts", JSON.stringify(keepReceiptPaths)); // รูปเดิมที่ยังเก็บไว้ (โหมดแก้ไข)
  for (const [k, v] of Object.entries(extra)) fd.set(k, v);
  return fd;
}

export type { EntryInput };
