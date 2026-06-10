"use client";

/**
 * หน้า VAT (E) — บ้านของภาษีมูลค่าเพิ่มแบบเต็มตัว.
 * - Hero: ภาษีสุทธิของเดือน (ต้องนำส่ง / ขอคืนได้) ตัวเลขใหญ่ count-up + สีตาม token
 *   net > 0 = ต้องนำส่ง (เงินออก) → expense/rose · net < 0 = ขอคืนได้ → income/green
 * - ตัวเลือกเดือน <Select> เขียนลง URL (?m=YYYY-MM) แบบเดียวกับ EntryFilters
 * - แยกแยะ: ภาษีขาย (output) / ภาษีซื้อ (input) / ภาษีสุทธิ (net) ด้วย StatCard
 * - ประโยคช่วยสไตล์ ภ.พ.30 อบอุ่น เป็นมิตร
 * คำนวณจริงมาจาก monthlyVatSummary (lib/queries) — ที่นี่แค่แสดงผล (คงสตางค์เป๊ะ).
 */

import { useRouter } from "next/navigation";
import { Receipt, ArrowUpRight, ArrowDownLeft, Info } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/stat-card";
import { AnimatedMoney } from "@/components/animated-money";
import { EmptyState } from "@/components/states";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { VatSummary } from "@/lib/queries";
import type { MonthOption } from "@/lib/dates";

export function VatView({
  monthKey,
  monthLabel,
  months,
  vat,
}: {
  monthKey: string;
  monthLabel: string;
  months: MonthOption[];
  vat: VatSummary;
}) {
  const router = useRouter();

  // net > 0 = ต้องนำส่งสรรพากร (เงินออก) · net < 0 = ขอคืนได้ (เงินเข้า) · 0 = พอดี
  const payable = vat.netVatSatang > 0;
  const refundable = vat.netVatSatang < 0;

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-foreground">ภาษีมูลค่าเพิ่ม (VAT)</h1>
          <p className="text-sm text-muted-foreground">สรุปภาษีขาย − ภาษีซื้อ สำหรับยื่น ภ.พ.30</p>
        </div>
      </header>

      {/* ตัวเลือกเดือน — เขียนลง URL (?m=) */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">เลือกเดือน</label>
        <Select
          value={monthKey}
          onValueChange={(v) => router.push(`/vat?m=${v}`)}
        >
          <SelectTrigger className="h-10 w-full sm:max-w-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {vat.vatEntryCount === 0 ? (
        <EmptyState
          name="receipt"
          title="เดือนนี้ยังไม่มีรายการที่คิด VAT"
          description="ใส่ VAT 7% ตอนบันทึกรายรับ/รายจ่าย แล้วยอดภาษีจะมาสรุปที่นี่ให้พร้อมยื่น"
        />
      ) : (
        <>
          {/* Hero — ภาษีสุทธิของเดือน (เด่นสุด) */}
          <div
            className={cn(
              "rounded-3xl border bg-card p-6 shadow-warm animate-fade-slide-up",
              payable ? "border-expense/30" : refundable ? "border-income/25" : "border-border",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full",
                    payable
                      ? "bg-expense-soft text-expense"
                      : refundable
                        ? "bg-income-soft text-income"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  <Receipt className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold text-foreground">
                  {payable
                    ? "ภาษีที่ต้องนำส่ง"
                    : refundable
                      ? "ภาษีที่ขอคืนได้"
                      : "ภาษีสุทธิเดือนนี้"}
                </p>
              </div>
              {payable ? (
                <Badge className="gap-1 bg-expense text-expense-foreground hover:bg-expense">
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  ต้องนำส่ง
                </Badge>
              ) : refundable ? (
                <Badge className="gap-1 bg-income text-income-foreground hover:bg-income">
                  <ArrowDownLeft className="h-3.5 w-3.5" />
                  ขอคืนได้
                </Badge>
              ) : (
                <Badge variant="secondary">พอดี</Badge>
              )}
            </div>

            {/* แสดงเป็นจำนวนบวกเสมอ (ป้าย/สีบอกทิศทางแทนเครื่องหมาย) */}
            <AnimatedMoney
              satang={Math.abs(vat.netVatSatang)}
              tone={payable ? "expense" : refundable ? "income" : "neutral"}
              className="mt-3 block text-5xl font-bold leading-tight tracking-tight sm:text-6xl"
            />

            <p className="relative mt-3 flex items-center gap-2 text-base font-medium text-foreground/80">
              {payable ? (
                <>
                  <span className="text-xl leading-none">📨</span>
                  <span>ภาษีขายมากกว่าภาษีซื้อ เตรียมยื่นนำส่งสรรพากรได้เลย</span>
                </>
              ) : refundable ? (
                <>
                  <span className="text-xl leading-none">💚</span>
                  <span>ภาษีซื้อมากกว่าภาษีขาย เดือนนี้ขอคืน/ยกไปเครดิตได้</span>
                </>
              ) : (
                <>
                  <span className="text-xl leading-none">🙂</span>
                  <span>ภาษีขายเท่ากับภาษีซื้อพอดี เดือนนี้ไม่ต้องนำส่งเพิ่ม</span>
                </>
              )}
            </p>

            <p className="relative mt-1 text-xs text-muted-foreground">
              {monthLabel} · จาก {vat.vatEntryCount} รายการที่คิด VAT
            </p>
          </div>

          {/* แยกแยะ ภาษีขาย / ภาษีซื้อ */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="ภาษีขาย (Output)"
              satang={vat.outputVatSatang}
              variant="income"
              hint="VAT จากรายรับที่ติดภาษี"
            />
            <StatCard
              label="ภาษีซื้อ (Input)"
              satang={vat.inputVatSatang}
              variant="expense"
              hint="VAT จากรายจ่ายที่หักได้"
            />
          </div>

          {/* รายละเอียดการคำนวณ */}
          <Card>
            <CardContent className="space-y-2.5 p-4">
              <h2 className="font-semibold text-foreground">รายละเอียดการคำนวณ</h2>
              <dl className="space-y-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">ฐานรายรับก่อน VAT</dt>
                  <dd className="font-medium tabular-nums text-foreground">
                    {formatMoney(vat.outputBaseSatang)}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">ภาษีขาย (Output VAT)</dt>
                  <dd className="font-medium tabular-nums text-income">
                    {formatMoney(vat.outputVatSatang)}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">หัก ภาษีซื้อ (Input VAT)</dt>
                  <dd className="font-medium tabular-nums text-expense">
                    −{formatMoney(vat.inputVatSatang)}
                  </dd>
                </div>
                <div className="flex items-center justify-between border-t border-border pt-2.5">
                  <dt className="font-semibold text-foreground">
                    ภาษีสุทธิ {payable ? "(ต้องนำส่ง)" : refundable ? "(ขอคืนได้)" : ""}
                  </dt>
                  <dd
                    className={cn(
                      "text-base font-bold tabular-nums",
                      payable ? "text-expense" : refundable ? "text-income" : "text-foreground",
                    )}
                  >
                    {refundable ? "−" : ""}
                    {formatMoney(Math.abs(vat.netVatSatang))}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {/* ประโยคช่วยสไตล์ ภ.พ.30 */}
          <div className="flex items-start gap-2.5 rounded-2xl border border-brand/20 bg-brand-soft/40 p-3.5 text-sm text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
            <p>
              ตัวเลข <span className="font-medium text-foreground">ภาษีสุทธิ</span> นี้คือ
              ภาษีขาย − ภาษีซื้อ ตามแบบ <span className="font-medium text-foreground">ภ.พ.30</span> โดยประมาณ
              ยื่นได้ภายในวันที่ 15 ของเดือนถัดไป — โปรดตรวจสอบกับเอกสารจริงก่อนยื่นทุกครั้งนะ
            </p>
          </div>
        </>
      )}
    </div>
  );
}
