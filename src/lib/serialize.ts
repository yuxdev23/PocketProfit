import "server-only";

/**
 * แปลง Prisma Entry -> EntryView (plain object) ก่อนส่งข้าม Server→Client boundary.
 * (ไม่ส่ง Date/Prisma instance ตรงๆ — กัน serialization edge.)
 */

import type { EntryView } from "@/components/entry-list";
import { bkkDateKey } from "@/lib/dates";

type PrismaEntryLike = {
  id: string;
  type: string;
  categoryName: string;
  categoryId: string | null;
  amountSatang: number;
  occurredAt: Date;
  note: string | null;
  receiptPaths: string | null;
  vatRate: number;
  vatAmountSatang: number;
  _count?: { revisions: number };
};

export function toEntryView(e: PrismaEntryLike): EntryView {
  return {
    id: e.id,
    type: e.type === "income" ? "income" : "expense",
    categoryName: e.categoryName,
    categoryId: e.categoryId,
    amountSatang: e.amountSatang,
    occurredAtISO: e.occurredAt.toISOString(),
    note: e.note,
    receiptPaths: e.receiptPaths,
    vatRate: e.vatRate,
    vatAmountSatang: e.vatAmountSatang,
    revisionCount: e._count?.revisions ?? 0,
    dateKey: bkkDateKey(e.occurredAt),
  };
}
