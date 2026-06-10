"use client";

import Link from "next/link";
import { AlertTriangle, Check, Pencil, Plus, ListChecks } from "lucide-react";

import type { BudgetRow } from "@/lib/queries";
import { usagePct } from "@/lib/calc";
import { formatBaht, formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ColorBar } from "@/components/ui/color-bar";
import { SetBudgetDialog } from "@/components/set-budget-dialog";

/**
 * F2 / DoD-2 — แถวหมวดที่ "ตั้งงบแล้ว" พร้อมพอร์ตจุดแข็งจาก shop:
 *  1. microcopy ให้กำลังใจรายหมวด + สีสถานะ (ในงบ/ใกล้เต็ม/เกิน)
 *  2. เรียง "แย่สุดก่อน" — เกินงบ → ใกล้เต็ม → ในงบ
 *  3. แถบสัดส่วน %-share ของหมวดเทียบยอดใช้จ่ายรวมทั้งกลุ่ม (token, dark-safe)
 * คงปุ่มแก้งบ/ตั้งงบเดิม และยอดสตางค์ครบถ้วน (additive).
 */

type BudgetState = "over" | "near" | "healthy";

/** เกณฑ์เดียวกับ shop: >100% เกินงบ, >=90% ใกล้เต็ม, ที่เหลือยังในงบ. */
function budgetState(actualSatang: number, budgetSatang: number): BudgetState {
  if (actualSatang > budgetSatang) return "over";
  if (usagePct(actualSatang, budgetSatang) >= 90) return "near";
  return "healthy";
}

/** ลำดับการเรียง: แย่สุดอยู่บน. */
const STATE_RANK: Record<BudgetState, number> = { over: 0, near: 1, healthy: 2 };

export type MonthRange = { from: string; to: string };

/** ปุ่มไอคอนเล็ก → ไปหน้า "รายการทั้งหมด" กรองเฉพาะหมวดนี้ + เดือนนี้ให้พร้อม */
export function CategoryEntriesLink({
  categoryId,
  name,
  monthRange,
}: {
  categoryId: string;
  name: string;
  monthRange: MonthRange;
}) {
  return (
    <Link
      href={`/entries?categoryId=${categoryId}&from=${monthRange.from}&to=${monthRange.to}`}
      aria-label={`ดูรายการของหมวด ${name} ในเดือนที่เลือก`}
      title={`ดูรายการ ${name}`}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-brand"
    >
      <ListChecks className="h-[18px] w-[18px]" strokeWidth={2.25} />
    </Link>
  );
}

export function BudgetRows({
  rows,
  groupTotalSatang,
  monthRange,
  editable = true,
}: {
  /** เฉพาะหมวดรายจ่ายที่ตั้งงบแล้ว (budgetSatang != null). */
  rows: BudgetRow[];
  /** ยอดใช้จ่ายรวมของทั้งกลุ่ม สำหรับคิดสัดส่วน %-share. */
  groupTotalSatang: number;
  monthRange: MonthRange;
  /** false = อ่านอย่างเดียว (ดูย้อนหลัง) → ซ่อนปุ่ม "แก้งบ" */
  editable?: boolean;
}) {
  // จัดเรียง "แย่สุดก่อน" แล้วตามด้วยใช้งบมาก→น้อย (ภายในสถานะเดียวกัน).
  const sorted = [...rows].sort((a, b) => {
    const budgetA = a.budgetSatang ?? 0;
    const budgetB = b.budgetSatang ?? 0;
    const rankA = STATE_RANK[budgetState(a.actualSatang, budgetA)];
    const rankB = STATE_RANK[budgetState(b.actualSatang, budgetB)];
    if (rankA !== rankB) return rankA - rankB;
    return usagePct(b.actualSatang, budgetB) - usagePct(a.actualSatang, budgetA);
  });

  return (
    <section className="space-y-3">
      {sorted.map((r) => {
        const budget = r.budgetSatang ?? 0;
        const pct = usagePct(r.actualSatang, budget);
        const state = budgetState(r.actualSatang, budget);
        const over = state === "over";
        const near = state === "near";
        const remaining = budget - r.actualSatang;
        // สัดส่วนของยอดใช้จ่ายรวมทั้งกลุ่ม (กันหารศูนย์).
        const share = groupTotalSatang > 0 ? (r.actualSatang / groupTotalSatang) * 100 : 0;

        return (
          <Card
            key={r.categoryId}
            className={cn(
              "transition-colors hover:border-brand/30",
              over && "border-expense/50",
              near && "border-warning/50",
            )}
          >
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">{r.name}</span>
                  {over ? (
                    <Badge className="bg-expense text-expense-foreground hover:bg-expense">
                      <AlertTriangle className="mr-1 h-3 w-3" /> เกินงบ
                    </Badge>
                  ) : near ? (
                    <Badge className="bg-warning text-warning-foreground hover:bg-warning">ใกล้เต็มงบ</Badge>
                  ) : (
                    <Badge variant="secondary">
                      <Check className="mr-1 h-3 w-3" /> ในงบ
                    </Badge>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <CategoryEntriesLink categoryId={r.categoryId} name={r.name} monthRange={monthRange} />
                  {editable ? (
                    <SetBudgetDialog
                      categoryId={r.categoryId}
                      categoryName={r.name}
                      currentBudgetBaht={String(budget / 100)}
                      trigger={
                        <Button variant="ghost" size="sm" className="h-8">
                          <Pencil className="mr-1 h-3.5 w-3.5" /> แก้งบ
                        </Button>
                      }
                    />
                  ) : null}
                </div>
              </div>

              <ColorBar value={pct} tone={over ? "expense" : near ? "warning" : "neutral"} />

              {/* microcopy ให้กำลังใจรายหมวด + สีสถานะ (พอร์ตจาก shop) */}
              {over ? (
                <p className="flex items-center gap-1 text-xs font-medium text-expense">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  เกินงบ {formatMoney(r.actualSatang - budget)} — ลองคุมหมวดนี้สักหน่อยนะ
                </p>
              ) : near ? (
                <p className="flex items-center gap-1 text-xs font-medium text-warning">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  ใกล้เต็มงบแล้ว เหลืออีก {formatMoney(remaining)}
                </p>
              ) : (
                <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                  <Check className="h-3.5 w-3.5 shrink-0" />
                  ยังอยู่ในงบ ✓ เหลืออีก {formatMoney(remaining)}
                </p>
              )}

              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">ใช้จริง</p>
                  <p className="font-semibold tabular-nums text-foreground">{formatMoney(r.actualSatang)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">งบ</p>
                  <p className="font-semibold tabular-nums text-foreground">{formatMoney(budget)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">{remaining < 0 ? "เกินงบ" : "คงเหลือ"}</p>
                  <p
                    className={cn(
                      "font-semibold tabular-nums",
                      remaining < 0 ? "text-expense" : "text-foreground",
                    )}
                  >
                    {remaining < 0 ? "−" : ""}฿{formatBaht(Math.abs(remaining))}
                  </p>
                </div>
              </div>

              {/* สัดส่วน %-share ของยอดใช้จ่ายรวมทั้งกลุ่ม (token, dark-safe) */}
              {groupTotalSatang > 0 ? (
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>คิดเป็น {share.toFixed(0)}% ของรายจ่ายรวม</span>
                  <span className="tabular-nums">ใช้ไป {pct}% ของงบ</span>
                </div>
              ) : (
                <p className="text-right text-xs font-medium text-muted-foreground">ใช้ไป {pct}% ของงบ</p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}

/**
 * F2 — แถวหมวดที่ "ยังไม่ตั้งงบ" เรียงตามใช้จ่ายมาก→น้อย พร้อมแถบสัดส่วนเล็กๆ
 * เพื่อให้เห็นว่าหมวดไหนกินค่าใช้จ่ายเยอะแม้ยังไม่มีงบ (ชวนให้ตั้งงบ).
 */
export function UnbudgetedRows({
  rows,
  groupTotalSatang,
  monthRange,
  isCurrentMonth = true,
  editable = true,
}: {
  rows: BudgetRow[];
  groupTotalSatang: number;
  monthRange: MonthRange;
  isCurrentMonth?: boolean;
  /** false = อ่านอย่างเดียว (ดูย้อนหลัง) → ซ่อนปุ่ม "ตั้งงบ" */
  editable?: boolean;
}) {
  const sorted = [...rows].sort((a, b) => b.actualSatang - a.actualSatang);

  return (
    <div className="space-y-2">
      {sorted.map((r) => {
        const share = groupTotalSatang > 0 ? (r.actualSatang / groupTotalSatang) * 100 : 0;
        return (
          <Card key={r.categoryId} className="transition-colors hover:border-brand/30">
            <CardContent className="space-y-2 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{r.name}</p>
                  <p className="text-xs text-muted-foreground">
                    ใช้ไป {formatMoney(r.actualSatang)}
                    {isCurrentMonth ? " เดือนนี้" : ""}
                    {groupTotalSatang > 0 ? ` · ${share.toFixed(0)}% ของรายจ่ายรวม` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <CategoryEntriesLink categoryId={r.categoryId} name={r.name} monthRange={monthRange} />
                  {editable ? (
                    <SetBudgetDialog
                      categoryId={r.categoryId}
                      categoryName={r.name}
                      currentBudgetBaht=""
                      trigger={
                        <Button variant="outline" size="sm" className="h-9 shrink-0">
                          <Plus className="mr-1 h-4 w-4" /> ตั้งงบ
                        </Button>
                      }
                    />
                  ) : null}
                </div>
              </div>
              {groupTotalSatang > 0 && r.actualSatang > 0 ? (
                <ColorBar value={share} tone="neutral" className="h-2" />
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
