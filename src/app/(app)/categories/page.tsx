import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/states";
import { AddCategoryDialog, RenameCategoryDialog } from "@/components/category-dialogs";
import { DeleteButton } from "@/components/delete-button";
import { deleteCategory } from "@/lib/actions/categories";

export default async function CategoriesPage() {
  const user = await requireUser();

  // ดึงหมวด + นับรายการที่ใช้ (ผูก userId)
  const categories = await prisma.category.findMany({
    where: { userId: user.id, archived: false },
    orderBy: [{ kind: "asc" }, { createdAt: "asc" }],
    // นับเฉพาะรายการที่ยัง "ไม่ถูกลบ" (soft-delete) — กันป้ายจำนวน/ข้อความ dialog เพี้ยน
    include: { _count: { select: { entries: { where: { deletedAt: null } } } } },
  });

  const expense = categories.filter((c) => c.kind === "expense");
  const income = categories.filter((c) => c.kind === "income");

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold text-foreground">จัดการหมวด</h1>
          <p className="text-sm text-muted-foreground">เพิ่ม/แก้ชื่อ/ลบหมวดของคุณเอง</p>
        </div>
        <AddCategoryDialog />
      </header>

      {categories.length === 0 ? (
        <EmptyState name="inbox" title="ยังไม่มีหมวด" description="เพิ่มหมวดแรกเพื่อใช้ตอนบันทึกรายการ" />
      ) : (
        <>
          <CategoryGroup label="หมวดรายจ่าย" items={expense} kindBadge="รายจ่าย" />
          <CategoryGroup label="หมวดรายรับ" items={income} kindBadge="รายรับ" />
        </>
      )}
    </div>
  );
}

function CategoryGroup({
  label,
  items,
  kindBadge,
}: {
  label: string;
  items: { id: string; name: string; _count: { entries: number } }[];
  kindBadge: string;
}) {
  if (items.length === 0) return null;
  const isIncome = kindBadge === "รายรับ";
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-muted-foreground">{label}</h2>
      <div className="space-y-2">
        {items.map((c) => (
          <Card key={c.id}>
            <CardContent className="flex items-center gap-2 p-3">
              <Badge
                variant="outline"
                className={isIncome ? "border-income/40 text-income" : "border-expense/40 text-expense"}
              >
                {kindBadge}
              </Badge>
              <span className="min-w-0 flex-1 truncate font-medium text-foreground">{c.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{c._count.entries} รายการ</span>
              <RenameCategoryDialog id={c.id} currentName={c.name} />
              <DeleteButton
                id={c.id}
                action={deleteCategory}
                title="ลบหมวดนี้?"
                description={
                  c._count.entries > 0
                    ? "หมวดนี้มีรายการอยู่ — จะถูกซ่อนจากตัวเลือก แต่รายการเดิมยังเก็บชื่อหมวดไว้"
                    : "ลบหมวดนี้ออกถาวร ยืนยันหรือไม่?"
                }
                successMessage="ลบหมวดแล้ว"
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
