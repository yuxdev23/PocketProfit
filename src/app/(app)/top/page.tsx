import type { Metadata } from "next";
import { Trophy } from "lucide-react";

import { requireUser } from "@/lib/auth";
import { topProfitCategories, topProfitProducts } from "@/lib/queries";
import { TopProfitView } from "@/components/top-profit-view";

export const metadata: Metadata = {
  title: "อันดับกำไรดี",
};

export const dynamic = "force-dynamic";

export default async function TopPage() {
  const user = await requireUser();
  const [categories, products] = await Promise.all([
    topProfitCategories(user.id, 10),
    topProfitProducts(user.id, 10),
  ]);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-lg font-bold text-foreground">
          <Trophy className="h-5 w-5 text-brand" />
          อันดับกำไรดี
        </h1>
        <p className="text-sm text-muted-foreground">
          Top 10 หมวดและสินค้าที่ทำกำไรดีที่สุดของร้าน
        </p>
      </header>

      <TopProfitView categories={categories} products={products} />
    </div>
  );
}
