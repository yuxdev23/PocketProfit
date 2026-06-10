import { Plus, Pencil, AlertTriangle } from "lucide-react";

import { requireUser } from "@/lib/auth";
import { listProducts } from "@/lib/queries";
import { marginPct } from "@/lib/calc";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/states";
import { ProductDialog } from "@/components/product-dialog";
import { DeleteButton } from "@/components/delete-button";
import { deleteProduct } from "@/lib/actions/products";

export default async function ProductsPage() {
  const user = await requireUser();
  const products = await listProducts(user.id);

  // สรุประดับลิสต์: นับสินค้าที่กำไรขั้นต้นต่ำกว่าเกณฑ์ (ใช้ตรรกะเดียวกับแต่ละแถว)
  const lowMarginCount = products.filter(
    (p) => marginPct(p.costSatang, p.priceSatang) < p.lowMarginThresholdPct,
  ).length;

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold text-foreground">บริหารกำไรขั้นต้นของสินค้า</h1>
          <p className="text-sm text-muted-foreground">ตั้งต้นทุน/ราคาขาย → เห็นกำไรขั้นต้น %</p>
        </div>
        <ProductDialog
          mode="create"
          trigger={
            <Button className="bg-brand text-brand-foreground hover:bg-brand/90">
              <Plus className="mr-1 h-4 w-4" /> เพิ่มสินค้า
            </Button>
          }
        />
      </header>

      {products.length === 0 ? (
        <EmptyState
          name="inbox"
          title="ยังไม่มีสินค้า"
          description="เพิ่มสินค้าเพื่อดูกำไรขั้นต้น % และรับการเตือนเมื่อกำไรต่ำ"
        />
      ) : (
        <div className="space-y-2.5">
          {lowMarginCount > 0 ? (
            <Alert className="border-expense/40 bg-expense-soft text-foreground">
              <AlertTriangle className="h-4 w-4 text-expense" />
              <AlertTitle className="text-expense">มี {lowMarginCount} สินค้ากำไรขั้นต้นต่ำ</AlertTitle>
              <AlertDescription className="text-foreground/80">
                ลองทบทวนต้นทุน/ราคาขาย เพื่อเพิ่มกำไรขั้นต้นให้สูงกว่าเกณฑ์
              </AlertDescription>
            </Alert>
          ) : null}
          {products.map((p) => {
            const pct = marginPct(p.costSatang, p.priceSatang);
            const low = pct < p.lowMarginThresholdPct;
            const belowCost = p.priceSatang < p.costSatang;
            return (
              <Card key={p.id} className={cn(low && "border-expense/40")}>
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-semibold text-foreground">{p.name}</span>
                      {belowCost ? (
                        <Badge className="bg-expense text-expense-foreground hover:bg-expense">
                          <AlertTriangle className="mr-1 h-3 w-3" /> ขาดทุน
                        </Badge>
                      ) : low ? (
                        <Badge className="bg-expense text-expense-foreground hover:bg-expense">
                          <AlertTriangle className="mr-1 h-3 w-3" /> กำไรต่ำ
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      ทุน {formatMoney(p.costSatang)} · ขาย {formatMoney(p.priceSatang)} · เกณฑ์เตือน &lt;{p.lowMarginThresholdPct}%
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={cn("text-2xl font-extrabold tabular-nums", low ? "text-expense" : "text-income")}>
                      {pct}%
                    </p>
                    <p className="text-[10px] text-muted-foreground">กำไรขั้นต้น</p>
                  </div>
                  <div className="flex shrink-0 flex-col">
                    <ProductDialog
                      mode="edit"
                      initial={{
                        id: p.id,
                        name: p.name,
                        cost: String(p.costSatang / 100),
                        price: String(p.priceSatang / 100),
                        lowMarginThreshold: String(p.lowMarginThresholdPct),
                      }}
                      trigger={
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="แก้ไข">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      }
                    />
                    <DeleteButton
                      id={p.id}
                      action={deleteProduct}
                      title="ลบสินค้านี้?"
                      description="ลบแล้วจะไม่แสดงในรายการสินค้าอีก ยืนยันหรือไม่?"
                      successMessage="ลบสินค้าแล้ว"
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
