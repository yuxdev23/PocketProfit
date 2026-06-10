"use client";

/**
 * ประวัติการแก้ไขรายการ (F7, EDGE-1): ค่าเดิม → ค่าใหม่ + เหตุผล + เวลา.
 * จัดกลุ่ม "ต่อครั้งที่แก้" (per-revision): การแก้ไขครั้งเดียวอาจเปลี่ยนหลายฟิลด์
 * — รวมไว้ในบล็อกเดียว (เวลา + เหตุผลร่วมกัน) แทนที่จะแยกทีละฟิลด์.
 * รองรับบล็อก "ลบรายการ" แยกต่างหาก.
 */

import { useCallback, useEffect, useState } from "react";
import { History, Loader2, RotateCw, Trash2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { fetchRevisions } from "@/lib/actions/entries";
import type { RevisionView } from "@/lib/actions/types";
import { formatThaiDateTime, formatThaiDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

const FIELD_LABEL: Record<string, string> = {
  amountSatang: "จำนวนเงิน",
  type: "ประเภท",
  categoryName: "หมวด",
  occurredAt: "วันที่",
  note: "หมายเหตุ",
  vatRate: "VAT",
};

/** ฟิลด์พิเศษที่หมายถึง "ลบรายการ" (audit ของการลบ) — แสดงเป็นบล็อกของตัวเอง. */
const DELETE_FIELDS = new Set(["__deleted__", "deleted"]);

function fmtValue(field: string, value: string): string {
  if (field === "amountSatang") return formatMoney(Number(value));
  if (field === "type") return value === "income" ? "รายรับ" : "รายจ่าย";
  if (field === "occurredAt") return formatThaiDate(new Date(value));
  if (field === "vatRate") return value === "0" ? "ไม่มี" : `${value}%`;
  if (field === "note") return value || "(ว่าง)";
  return value || "(ว่าง)";
}

/**
 * รวมแถวแบบรายฟิลด์ (RevisionView) ให้เป็น "ครั้งที่แก้" (revision).
 * แถวที่มาจากการแก้ครั้งเดียวกันถูกเขียนใน transaction เดียว → มี reason เดียวกัน
 * และเวลาตรงกันถึงระดับวินาที จึงใช้คู่ (เวลาวินาที + เหตุผล) เป็นคีย์จัดกลุ่ม.
 * คงลำดับใหม่→เก่าตามที่ action ส่งมา (createdAt desc).
 */
type RevisionGroup = {
  key: string;
  createdAt: string; // ISO ของแถวแรกในกลุ่ม
  reason: string;
  deleted: boolean;
  changes: RevisionView[]; // ฟิลด์ที่เปลี่ยนในครั้งนี้ (ว่างได้ถ้าเป็นการลบ)
};

function groupRevisions(rows: RevisionView[]): RevisionGroup[] {
  const groups: RevisionGroup[] = [];
  const byKey = new Map<string, RevisionGroup>();

  for (const r of rows) {
    // ปัดเวลาเป็นวินาที (ตัด ms) เพื่อให้แถวจาก transaction เดียวกันจับคู่กันได้
    const second = r.createdAt.slice(0, 19);
    const key = `${second}|${r.reason}`;
    let g = byKey.get(key);
    if (!g) {
      g = {
        key,
        createdAt: r.createdAt,
        reason: r.reason,
        deleted: false,
        changes: [],
      };
      byKey.set(key, g);
      groups.push(g);
    }
    if (DELETE_FIELDS.has(r.field)) g.deleted = true;
    else g.changes.push(r);
  }

  return groups;
}

export function HistoryDialog({
  open,
  onOpenChange,
  entryId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  entryId: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revisions, setRevisions] = useState<RevisionView[]>([]);

  const load = useCallback(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchRevisions(entryId)
      .then((res) => {
        if (!active) return;
        if (res.ok) setRevisions(res.revisions);
        else setError(res.error);
      })
      .catch(() => active && setError("โหลดประวัติไม่สำเร็จ ลองอีกครั้ง"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [entryId]);

  useEffect(() => {
    if (!open) return;
    return load();
  }, [open, load]);

  const groups = groupRevisions(revisions);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-brand" />
            ประวัติการแก้ไข
          </DialogTitle>
          <DialogDescription>การเปลี่ยนแปลงทั้งหมดของรายการนี้</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> กำลังโหลด…
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-sm text-expense">{error}</p>
            <p className="text-xs text-muted-foreground">
              อาจเป็นปัญหาชั่วคราว ลองโหลดใหม่อีกครั้งได้เลย
            </p>
            <Button type="button" variant="outline" size="sm" onClick={load}>
              <RotateCw className="mr-1.5 h-4 w-4" />
              ลองอีกครั้ง
            </Button>
          </div>
        ) : groups.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            ยังไม่มีการแก้ไขรายการนี้
          </p>
        ) : (
          <ol className="space-y-3">
            {groups.map((g) => (
              <li key={g.key} className="rounded-lg border border-border p-3 text-sm">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 font-semibold text-foreground">
                    {g.deleted ? (
                      <>
                        <Trash2 className="h-4 w-4 text-expense" />
                        ลบรายการ
                      </>
                    ) : (
                      "แก้ไขรายการ"
                    )}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatThaiDateTime(new Date(g.createdAt))}
                  </span>
                </div>

                <div className="mb-2 text-xs text-muted-foreground">
                  เหตุผล: &quot;{g.reason}&quot;
                </div>

                {g.deleted ? null : g.changes.length > 0 ? (
                  <ul className="space-y-1.5">
                    {g.changes.map((c) => (
                      <li
                        key={c.id}
                        className="rounded-lg bg-muted/50 px-2.5 py-1.5 text-xs"
                      >
                        <span className="font-medium text-muted-foreground">
                          {FIELD_LABEL[c.field] ?? c.field}
                        </span>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                          <span className="rounded bg-expense-soft px-1.5 py-0.5 text-expense line-through">
                            {fmtValue(c.field, c.oldValue)}
                          </span>
                          <span className="text-muted-foreground">→</span>
                          <span className="rounded bg-income-soft px-1.5 py-0.5 font-medium text-income">
                            {fmtValue(c.field, c.newValue)}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">(ไม่มีฟิลด์ที่เปลี่ยนแปลง)</p>
                )}
              </li>
            ))}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  );
}
