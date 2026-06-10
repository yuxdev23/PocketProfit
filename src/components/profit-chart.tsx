"use client";

/** ProfitChart (DoD-3, F3) — BarChart รายวัน/รายเดือน ด้วย recharts + warm chart tokens. */

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney, satangToBaht } from "@/lib/money";

export type ChartPoint = { label: string; net: number };

/** ยอดรวมของเดือนหนึ่ง (สตางค์) สำหรับกราฟเทียบ. */
export type CompareTotals = { income: number; expense: number; net: number };

export function ProfitChart({ data }: { data: ChartPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center rounded-2xl border border-dashed border-brand/25 bg-brand-soft/30 text-sm text-muted-foreground">
        ยังไม่มีข้อมูลพอแสดงกราฟ
      </div>
    );
  }
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }} barCategoryGap="22%">
          <defs>
            <linearGradient id="ppBarIncome" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--income))" stopOpacity={0.95} />
              <stop offset="100%" stopColor="hsl(var(--income))" stopOpacity={0.6} />
            </linearGradient>
            <linearGradient id="ppBarExpense" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--expense))" stopOpacity={0.95} />
              <stop offset="100%" stopColor="hsl(var(--expense))" stopOpacity={0.6} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            dy={4}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            width={44}
            tickFormatter={(v) => `${Math.round(Number(v) / 100)}`}
          />
          <Tooltip
            cursor={{ fill: "hsl(var(--accent-brand))", opacity: 0.1, radius: 8 }}
            formatter={(v: number) => [formatMoney(v), "กำไรสุทธิ"]}
            contentStyle={{
              borderRadius: 14,
              border: "1px solid hsl(var(--border))",
              fontSize: 12,
              padding: "8px 12px",
              background: "hsl(var(--popover))",
              color: "hsl(var(--popover-foreground))",
              boxShadow: "0 6px 16px -6px hsl(var(--shadow-color) / 0.18)",
            }}
            labelStyle={{ color: "hsl(var(--muted-foreground))", fontWeight: 600 }}
          />
          <Bar dataKey="net" radius={[8, 8, 0, 0]} maxBarSize={42}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.net < 0 ? "url(#ppBarExpense)" : "url(#ppBarIncome)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

type CompareDatum = {
  metric: string;
  ["เดือนก่อน"]: number;
  ["เดือนนี้"]: number;
};

const COMPARE_GRAD_BY_METRIC: Record<string, string> = {
  รายรับ: "ppCmpIncome",
  รายจ่าย: "ppCmpExpense",
  กำไร: "ppCmpBrand",
};

function compareGradFor(metric: string) {
  return COMPARE_GRAD_BY_METRIC[metric] ?? "ppCmpBrand";
}

/** ย่อบาทแกน Y: 12000 -> "12k", ติดลบรองรับ (กำไรขาดทุน). */
function compactBaht(v: number): string {
  return Math.abs(v) >= 1000
    ? `${(v / 1000).toLocaleString("th-TH", { maximumFractionDigits: 0 })}k`
    : v.toLocaleString("th-TH");
}

/**
 * CompareChart (F3) — กราฟแท่งเทียบ "เดือนก่อน vs เดือนนี้" ใน 3 ตัวชี้วัด
 * (รายรับ / รายจ่าย / กำไร). กำไรติดลบแสดงแท่งลบได้. ใช้ warm chart tokens + ย่อแกนเป็น k.
 * ทุกยอดรับเป็นสตางค์ แล้วแปลงเป็นบาทเฉพาะตอนวาด/แสดงผ่าน helper ใน @/lib/money.
 */
export function CompareChart({
  current,
  previous,
  hasPrevious,
}: {
  current: CompareTotals;
  previous: CompareTotals;
  hasPrevious: boolean;
}) {
  const data: CompareDatum[] = [
    {
      metric: "รายรับ",
      ["เดือนก่อน"]: satangToBaht(previous.income),
      ["เดือนนี้"]: satangToBaht(current.income),
    },
    {
      metric: "รายจ่าย",
      ["เดือนก่อน"]: satangToBaht(previous.expense),
      ["เดือนนี้"]: satangToBaht(current.expense),
    },
    {
      metric: "กำไร",
      ["เดือนก่อน"]: satangToBaht(previous.net),
      ["เดือนนี้"]: satangToBaht(current.net),
    },
  ];

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={6}>
          <defs>
            <linearGradient id="ppCmpIncome" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--income))" stopOpacity={1} />
              <stop offset="100%" stopColor="hsl(var(--income))" stopOpacity={0.72} />
            </linearGradient>
            <linearGradient id="ppCmpExpense" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--expense))" stopOpacity={1} />
              <stop offset="100%" stopColor="hsl(var(--expense))" stopOpacity={0.72} />
            </linearGradient>
            <linearGradient id="ppCmpBrand" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--accent-brand))" stopOpacity={1} />
              <stop offset="100%" stopColor="hsl(var(--accent-brand))" stopOpacity={0.7} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="hsl(var(--border))" />
          <XAxis
            dataKey="metric"
            tick={{ fontSize: 13, fontWeight: 600, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={{ stroke: "hsl(var(--border))" }}
            dy={4}
          />
          <YAxis
            tickFormatter={compactBaht}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            width={44}
          />
          <Tooltip
            cursor={{ fill: "hsl(var(--accent-brand))", opacity: 0.08 }}
            formatter={(v: number) => formatMoney(Math.round(Number(v) * 100))}
            contentStyle={{
              borderRadius: 14,
              border: "1px solid hsl(var(--border))",
              fontSize: 12,
              padding: "8px 12px",
              background: "hsl(var(--popover))",
              color: "hsl(var(--popover-foreground))",
              boxShadow: "0 6px 16px -6px hsl(var(--shadow-color) / 0.18)",
            }}
            labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 700, marginBottom: 4 }}
            itemStyle={{ color: "hsl(var(--popover-foreground))" }}
          />
          {hasPrevious ? (
            <Bar
              dataKey="เดือนก่อน"
              radius={[6, 6, 0, 0]}
              fill="hsl(var(--muted-foreground))"
              fillOpacity={0.35}
              maxBarSize={46}
            />
          ) : null}
          <Bar dataKey="เดือนนี้" radius={[6, 6, 0, 0]} maxBarSize={46}>
            {data.map((d, i) => (
              <Cell key={i} fill={`url(#${compareGradFor(d.metric)})`} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-2 flex justify-center gap-4 text-xs text-muted-foreground">
        {hasPrevious ? (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />
            เดือนก่อน
          </span>
        ) : null}
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-brand" />
          เดือนนี้
        </span>
      </div>
    </div>
  );
}
