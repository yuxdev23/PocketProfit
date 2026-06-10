"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { X, Download } from "lucide-react";

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
import type { CategoryOption } from "@/components/entry-form-fields";

const ALL = "__all__";

/** ตัวกรองรายการ (ประเภท/หมวด/ช่วงวันที่) — เขียนลง URL searchParams. */
export function EntryFilters({
  categories,
  current,
}: {
  categories: CategoryOption[];
  current: { type?: string; categoryId?: string; from?: string; to?: string };
}) {
  const router = useRouter();
  const params = useSearchParams();

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (!value || value === ALL) next.delete(key);
    else next.set(key, value);
    router.push(`/entries?${next.toString()}`);
  }

  const hasFilter = !!(current.type || current.categoryId || current.from || current.to);
  const exportHref = `/entries/export${params.toString() ? `?${params.toString()}` : ""}`;

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">ประเภท</Label>
          <Select value={current.type ?? ALL} onValueChange={(v) => setParam("type", v)}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>ทั้งหมด</SelectItem>
              <SelectItem value="income">รายรับ</SelectItem>
              <SelectItem value="expense">รายจ่าย</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">หมวด</Label>
          <Select value={current.categoryId ?? ALL} onValueChange={(v) => setParam("categoryId", v)}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="ทั้งหมด" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>ทั้งหมด</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">ตั้งแต่วันที่</Label>
          <Input
            type="date"
            className="h-9"
            value={current.from ?? ""}
            onChange={(e) => setParam("from", e.target.value || null)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">ถึงวันที่</Label>
          <Input
            type="date"
            className="h-9"
            value={current.to ?? ""}
            onChange={(e) => setParam("to", e.target.value || null)}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {hasFilter ? (
          <Button variant="ghost" size="sm" className="h-8" onClick={() => router.push("/entries")}>
            <X className="mr-1 h-4 w-4" /> ล้างตัวกรอง
          </Button>
        ) : (
          <span />
        )}
        <Button asChild variant="outline" size="sm" className="h-8">
          {/* N1: ดาวน์โหลด CSV ตามตัวกรองที่เลือก (download = navigation ปกติ) */}
          <a href={exportHref} download>
            <Download className="mr-1 h-4 w-4" /> ส่งออก CSV
          </a>
        </Button>
      </div>
    </div>
  );
}
