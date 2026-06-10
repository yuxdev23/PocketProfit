import { Suspense } from "react";

import { requireUser } from "@/lib/auth";
import { listEntries, listCategories, todayDateKey, type EntryKind } from "@/lib/queries";
import { toEntryView } from "@/lib/serialize";
import { formatMoney } from "@/lib/money";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/states";
import { Skeleton } from "@/components/ui/skeleton";
import { EntryList } from "@/components/entry-list";
import { EntryFilters } from "@/components/entry-filters";
import { Pagination } from "@/components/pagination";

type SearchParams = {
  type?: string;
  categoryId?: string;
  from?: string;
  to?: string;
  page?: string;
};

const PER_PAGE = 20;

export default async function EntriesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireUser();
  const sp = await searchParams;

  const type: EntryKind | undefined = sp.type === "income" || sp.type === "expense" ? sp.type : undefined;
  const filter = { type, categoryId: sp.categoryId, from: sp.from, to: sp.to };

  const [entries, categories] = await Promise.all([
    listEntries(user.id, filter),
    listCategories(user.id),
  ]);

  const options = categories.map((c) => ({ id: c.id, name: c.name, kind: c.kind as EntryKind }));
  const views = entries.map(toEntryView);

  const income = views.filter((e) => e.type === "income").reduce((s, e) => s + e.amountSatang, 0);
  const expense = views.filter((e) => e.type === "expense").reduce((s, e) => s + e.amountSatang, 0);

  // แบ่งหน้า: สรุป (จำนวน/ยอดรวม) ยังนับทุกรายการที่ตรงตัวกรอง ส่วนลิสต์โชว์ทีละหน้า
  const totalPages = Math.max(1, Math.ceil(views.length / PER_PAGE));
  const pageNum = Math.min(Math.max(1, Number(sp.page) || 1), totalPages);
  const start = (pageNum - 1) * PER_PAGE;
  const pageViews = views.slice(start, start + PER_PAGE);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-lg font-bold text-foreground">รายการทั้งหมด</h1>
        <p className="text-sm text-muted-foreground">ดู แก้ไข และดูประวัติการแก้ของทุกบิล</p>
      </header>

      <Suspense fallback={<Skeleton className="h-44 w-full rounded-xl" />}>
        <EntryFilters categories={options} current={sp} />
      </Suspense>

      {views.length > 0 ? (
        <Card>
          <CardContent className="flex items-center justify-between p-3 text-sm">
            <span className="text-muted-foreground">{views.length} รายการ</span>
            <span className="flex gap-3">
              <span className="font-semibold text-income">+{formatMoney(income)}</span>
              <span className="font-semibold text-expense">−{formatMoney(expense)}</span>
            </span>
          </CardContent>
        </Card>
      ) : null}

      {views.length === 0 ? (
        <EmptyState
          name="receipt"
          title="ยังไม่มีรายการในช่วงที่เลือก"
          description="ลองล้างตัวกรอง หรือกดปุ่ม + เพิ่มรายการ เพื่อเพิ่มรายการ"
        />
      ) : (
        <div className="space-y-3">
          {totalPages > 1 ? (
            <p className="px-1 text-xs text-muted-foreground">
              แสดง {start + 1}–{start + pageViews.length} จาก {views.length} รายการ
            </p>
          ) : null}
          <EntryList entries={pageViews} categories={options} todayKey={todayDateKey()} showDate />
          <Pagination
            currentPage={pageNum}
            totalPages={totalPages}
            baseParams={{ type: sp.type, categoryId: sp.categoryId, from: sp.from, to: sp.to }}
          />
        </div>
      )}
    </div>
  );
}
