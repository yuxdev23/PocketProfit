import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

const arrowCls =
  "flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground";
const arrowDisabledCls =
  "flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground/30";

/** เลขหน้าแบบมี … : แสดงหน้าแรก/สุดท้าย + รอบ ๆ หน้าปัจจุบัน เมื่อมีหลายหน้า */
function pageWindow(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) out.push("…");
  for (let p = start; p <= end; p++) out.push(p);
  if (end < total - 1) out.push("…");
  out.push(total);
  return out;
}

/**
 * แบ่งหน้า (server component) — ลิงก์ ?page=N โดยคงตัวกรองเดิมไว้ (type/categoryId/from/to).
 * ไม่มี state — เป็น <Link> ล้วน นำทางผ่าน URL เหมือนตัวกรอง.
 */
export function Pagination({
  currentPage,
  totalPages,
  baseParams,
}: {
  currentPage: number;
  totalPages: number;
  baseParams: Record<string, string | undefined>;
}) {
  if (totalPages <= 1) return null;

  const hrefFor = (p: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(baseParams)) {
      if (v) params.set(k, v);
    }
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return `/entries${qs ? `?${qs}` : ""}`;
  };

  const pages = pageWindow(currentPage, totalPages);

  return (
    <nav className="flex flex-wrap items-center justify-center gap-1 pt-1" aria-label="แบ่งหน้า">
      {currentPage > 1 ? (
        <Link href={hrefFor(currentPage - 1)} aria-label="หน้าก่อนหน้า" className={arrowCls}>
          <ChevronLeft className="h-4 w-4" />
        </Link>
      ) : (
        <span className={arrowDisabledCls} aria-hidden>
          <ChevronLeft className="h-4 w-4" />
        </span>
      )}

      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`e${i}`} className="px-1 text-sm text-muted-foreground">
            …
          </span>
        ) : (
          <Link
            key={p}
            href={hrefFor(p)}
            aria-current={p === currentPage ? "page" : undefined}
            className={cn(
              "flex h-9 min-w-9 items-center justify-center rounded-lg px-2.5 text-sm font-medium tabular-nums transition-colors",
              p === currentPage
                ? "bg-brand text-brand-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {p}
          </Link>
        ),
      )}

      {currentPage < totalPages ? (
        <Link href={hrefFor(currentPage + 1)} aria-label="หน้าถัดไป" className={arrowCls}>
          <ChevronRight className="h-4 w-4" />
        </Link>
      ) : (
        <span className={arrowDisabledCls} aria-hidden>
          <ChevronRight className="h-4 w-4" />
        </span>
      )}
    </nav>
  );
}
