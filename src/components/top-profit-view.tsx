"use client";

/**
 * TopProfitView — หน้า "อันดับกำไรดี" แบบแท็บ:
 *  - หมวดกำไรดี  : หมวดรายรับที่ทำเงินรวมมากสุด (Top 10)
 *  - สินค้ากำไรดี : สินค้าอัตรากำไรขั้นต้น (margin%) สูงสุด (Top 10)
 * แต่ละแถวมีเหรียญอันดับ (โพเดียม 1–3 เด่น) + ยอด/มาร์จิน. มี empty state ครบ.
 */

import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import type { TopCategory, TopProduct } from "@/lib/queries";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EmptyState } from "@/components/states";

/** เหรียญอันดับ — โพเดียม 1 = ทอง(amber), 2–3 = แบรนด์, ที่เหลือ = เทากลาง. */
function RankBadge({ rank }: { rank: number }) {
  return (
    <span
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums",
        rank === 1
          ? "bg-warning text-warning-foreground"
          : rank <= 3
            ? "bg-brand/15 text-brand"
            : "bg-muted text-muted-foreground",
      )}
    >
      {rank}
    </span>
  );
}

export function TopProfitView({
  categories,
  products,
}: {
  categories: TopCategory[];
  products: TopProduct[];
}) {
  const router = useRouter();

  return (
    <Tabs defaultValue="categories" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="categories">หมวดรายได้ดี</TabsTrigger>
        <TabsTrigger value="products">สินค้ากำไรดี</TabsTrigger>
      </TabsList>

      {/* หมวดกำไรดี */}
      <TabsContent value="categories" className="space-y-2">
        <p className="px-1 text-xs text-muted-foreground">
          หมวดรายรับที่ทำเงินให้ร้านมากที่สุด (รวมทุกช่วงเวลา)
        </p>
        {categories.length === 0 ? (
          <EmptyState
            name="pie"
            title="ยังไม่มีข้อมูลรายรับ"
            description="เริ่มบันทึกรายรับ แล้วหมวดที่ทำเงินดีที่สุดจะมาแสดงเป็นอันดับที่นี่"
          />
        ) : (
          categories.map((c, i) => (
            <Card key={c.name} className={cn(i === 0 && "border-warning/40")}>
              <CardContent className="flex items-center gap-3 p-3">
                <RankBadge rank={i + 1} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-foreground">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.count.toLocaleString("th-TH")} รายการ
                  </p>
                </div>
                <p className="shrink-0 text-base font-bold tabular-nums text-income">
                  {formatMoney(c.totalSatang)}
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </TabsContent>

      {/* สินค้ากำไรดี */}
      <TabsContent value="products" className="space-y-2">
        <p className="px-1 text-xs text-muted-foreground">
          สินค้าที่อัตรากำไรขั้นต้น (margin) สูงสุด
        </p>
        {products.length === 0 ? (
          <EmptyState
            name="inbox"
            title="ยังไม่มีสินค้า"
            description="เพิ่มสินค้าพร้อมต้นทุน–ราคาขาย แล้วดูว่าตัวไหนกำไรดีที่สุด"
            actionLabel="ไปเพิ่มสินค้า"
            onAction={() => router.push("/products")}
          />
        ) : (
          products.map((p, i) => (
            <Card key={p.id} className={cn(i === 0 && "border-warning/40")}>
              <CardContent className="flex items-center gap-3 p-3">
                <RankBadge rank={i + 1} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-foreground">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    กำไร/หน่วย {formatMoney(p.grossSatang)} · ขาย {formatMoney(p.priceSatang)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-base font-bold tabular-nums text-income">{p.marginPct}%</p>
                  <p className="text-[11px] text-muted-foreground">margin</p>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </TabsContent>
    </Tabs>
  );
}
