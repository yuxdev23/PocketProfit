"use client";

import type { LucideIcon } from "lucide-react";
import { Inbox, AlertCircle, Receipt, PieChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * ไอคอนเลือกด้วย "ชื่อ" (string) เพื่อให้ Server Component ส่งค่าข้าม boundary ได้
 * โดยไม่ส่ง function ข้ามไป client (กัน "Functions cannot be passed" — EDGE-9/13).
 */
const ICONS = { inbox: Inbox, receipt: Receipt, pie: PieChart } as const;
export type EmptyStateIcon = keyof typeof ICONS;

/** สถานะว่างมาตรฐาน (EDGE-9/13) */
export function EmptyState({
  name = "inbox",
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: {
  /** ชื่อไอคอน (ใช้จาก Server Component — ไม่ส่ง function ข้าม boundary) */
  name?: EmptyStateIcon;
  /** ส่ง LucideIcon ตรงๆ ได้เฉพาะจากฝั่ง client (override name) */
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}) {
  const Icon = icon ?? ICONS[name];
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-brand/25 bg-brand-soft/40 px-6 py-10 text-center",
        className
      )}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand/12 text-brand shadow-warm-sm">
        <Icon className="h-8 w-8" strokeWidth={1.8} />
      </div>
      <p className="text-base font-semibold text-foreground">{title}</p>
      {description ? (
        <p className="max-w-[34ch] text-sm text-muted-foreground">{description}</p>
      ) : null}
      {actionLabel && onAction ? (
        <Button onClick={onAction} className="mt-1">
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}

/** สถานะโหลดพลาด (EDGE-14 ฝั่งอ่าน) */
export function ErrorState({
  message = "เกิดข้อผิดพลาด ลองอีกครั้ง",
  onRetry,
  className,
}: {
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-expense/30 bg-expense-soft px-6 py-10 text-center",
        className
      )}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-expense/12 text-expense shadow-warm-sm">
        <AlertCircle className="h-8 w-8" strokeWidth={1.8} />
      </div>
      <p className="text-base font-semibold text-foreground">{message}</p>
      {onRetry ? (
        <Button variant="outline" className="mt-1" onClick={onRetry}>
          ลองใหม่
        </Button>
      ) : null}
    </div>
  );
}
