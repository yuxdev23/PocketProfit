"use client";

/**
 * NotesWorkspace — หน้าจัดการ "โน้ต/บันทึกย่อ" (feature note).
 * เลือกขอบเขตได้ 3 แบบ: รวม (global) / รายวัน (daily) / รายเดือน (monthly)
 * โดยมี "1 โน้ตต่อขอบเขต" (ต่อวัน/ต่อเดือน/รวม). ขับด้วย URL searchParams
 * (?scope=&day=&month=) เพื่อให้ server โหลดโน้ตที่ถูกต้องมาให้ — แนวเดียวกับหน้าอื่น.
 *
 * NoteEditor ถูก key ด้วย scope+scopeKey จึง remount (รีเซ็ตข้อความ) ทุกครั้งที่
 * เปลี่ยนวัน/เดือน/ขอบเขต ป้องกันข้อความค้างจากโน้ตก่อนหน้า.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  Loader2,
  Save,
  Trash2,
  Globe2,
  CalendarDays,
  CalendarRange,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { NOTE_MAX } from "@/lib/validation";
import { saveNote } from "@/lib/actions/notes";
import type { NoteScope } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

export type MonthChoice = { value: string; label: string };

const SCOPE_TABS: { value: NoteScope; label: string; icon: LucideIcon }[] = [
  { value: "global", label: "รวม", icon: Globe2 },
  { value: "daily", label: "รายวัน", icon: CalendarDays },
  { value: "monthly", label: "รายเดือน", icon: CalendarRange },
];

export function NotesWorkspace({
  scope,
  scopeKey,
  day,
  month,
  today,
  monthOptions,
  noteBody,
  updatedAtLabel,
}: {
  scope: NoteScope;
  scopeKey: string;
  day: string;
  month: string;
  today: string;
  monthOptions: MonthChoice[];
  noteBody: string;
  updatedAtLabel: string | null;
}) {
  const router = useRouter();

  // คงวัน/เดือนที่กำลังเลือกไว้เวลาสลับแท็บ (กดรายวันแล้วกลับมาได้วันเดิม)
  const hrefFor = (s: NoteScope) =>
    s === "daily"
      ? `/notes?scope=daily&day=${day}`
      : s === "monthly"
        ? `/notes?scope=monthly&month=${month}`
        : "/notes?scope=global";

  return (
    <div className="space-y-4">
      {/* สลับขอบเขตของโน้ต (รวม / รายวัน / รายเดือน) */}
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
        {SCOPE_TABS.map((t) => {
          const Icon = t.icon;
          const active = scope === t.value;
          return (
            <Link
              key={t.value}
              href={hrefFor(t.value)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-background text-foreground shadow"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={active ? 2.4 : 2} />
              {t.label}
            </Link>
          );
        })}
      </div>

      {/* ตัวเลือกวัน/เดือน ตามขอบเขต */}
      {scope === "daily" ? (
        <div className="space-y-1.5">
          <Label htmlFor="note-day">เลือกวันของโน้ต</Label>
          <Input
            id="note-day"
            type="date"
            value={day}
            max={today}
            onChange={(e) => {
              const v = e.target.value;
              if (v) router.push(`/notes?scope=daily&day=${v}`);
            }}
            className="h-11"
          />
        </div>
      ) : scope === "monthly" ? (
        <div className="space-y-1.5">
          <Label>เลือกเดือนของโน้ต</Label>
          <Select value={month} onValueChange={(v) => router.push(`/notes?scope=monthly&month=${v}`)}>
            <SelectTrigger aria-label="เลือกเดือนของโน้ต" className="h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
          โน้ตรวม — บันทึกเดียวสำหรับภาพรวมของร้าน ไม่ผูกกับวันหรือเดือน
        </p>
      )}

      <NoteEditor
        key={`${scope}:${scopeKey}`}
        scope={scope}
        scopeKey={scopeKey}
        initialBody={noteBody}
        updatedAtLabel={updatedAtLabel}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}

function NoteEditor({
  scope,
  scopeKey,
  initialBody,
  updatedAtLabel,
  onSaved,
}: {
  scope: NoteScope;
  scopeKey: string;
  initialBody: string;
  updatedAtLabel: string | null;
  onSaved: () => void;
}) {
  const [body, setBody] = useState(initialBody);
  const [savedBody, setSavedBody] = useState(initialBody);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const dirty = body !== savedBody;
  const overLimit = body.length > NOTE_MAX;
  const hasSaved = savedBody.trim().length > 0;

  const submit = (nextBody: string, onDone?: () => void) => {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("scope", scope);
      fd.set("scopeKey", scopeKey);
      fd.set("body", nextBody);
      const isDelete = nextBody.trim().length === 0;
      try {
        const res = await saveNote(fd);
        if (res.ok) {
          setSavedBody(nextBody);
          toast.success(isDelete ? "ลบโน้ตแล้ว" : "บันทึกโน้ตแล้ว");
          onSaved();
        } else if ("error" in res) {
          toast.error(res.error);
        }
      } catch {
        toast.error(
          isDelete
            ? "ลบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"
            : "บันทึกไม่สำเร็จ ลองอีกครั้ง — ข้อความที่พิมพ์ยังอยู่",
        );
      } finally {
        onDone?.();
      }
    });
  };

  return (
    <div className="space-y-2">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="พิมพ์โน้ตที่นี่… เช่น ของที่ต้องสั่งเพิ่ม ลูกค้าสั่งพิเศษ หรือสรุปสั้น ๆ ของช่วงนี้"
        aria-invalid={overLimit}
        aria-label="เนื้อหาโน้ต"
        className="min-h-[220px] resize-y leading-relaxed"
      />

      <div className="flex items-center justify-between gap-2 text-xs">
        <span className={cn("text-muted-foreground tabular-nums", overLimit && "font-medium text-destructive")}>
          {body.length.toLocaleString("th-TH")} / {NOTE_MAX.toLocaleString("th-TH")} ตัวอักษร
        </span>
        {dirty ? (
          <span className="font-medium text-warning">มีการแก้ไขที่ยังไม่บันทึก</span>
        ) : updatedAtLabel ? (
          <span className="text-muted-foreground">บันทึกล่าสุด {updatedAtLabel}</span>
        ) : null}
      </div>

      {overLimit ? (
        <p className="text-[0.8rem] font-medium text-destructive">
          โน้ตยาวเกินไป (สูงสุด {NOTE_MAX.toLocaleString("th-TH")} ตัวอักษร)
        </p>
      ) : null}

      <div className="flex items-center gap-2 pt-1">
        <Button
          onClick={() => submit(body)}
          disabled={pending || !dirty || overLimit}
          className="bg-brand text-brand-foreground hover:bg-brand/90"
        >
          {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          บันทึกโน้ต
        </Button>
        {hasSaved ? (
          <>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmOpen(true)}
              disabled={pending}
              className="text-expense hover:bg-expense-soft hover:text-expense"
            >
              <Trash2 className="mr-1.5 h-4 w-4" /> ลบโน้ต
            </Button>
            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>ลบโน้ตนี้?</AlertDialogTitle>
                  <AlertDialogDescription>
                    โน้ตนี้จะถูกลบถาวรและกู้คืนไม่ได้ ยืนยันการลบหรือไม่
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={pending}>ยกเลิก</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    disabled={pending}
                    onClick={(e) => {
                      e.preventDefault();
                      setBody("");
                      submit("", () => setConfirmOpen(false));
                    }}
                  >
                    ลบโน้ต
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        ) : null}
      </div>
    </div>
  );
}
