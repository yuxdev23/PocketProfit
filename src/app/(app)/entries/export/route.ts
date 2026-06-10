/**
 * N1: ส่งออกรายการเป็น CSV โดยกรองตามช่วงวันที่ (+ ประเภท/หมวด ถ้ามี).
 * GET /entries/export?from=YYYY-MM-DD&to=YYYY-MM-DD&type=income|expense&categoryId=...
 * - ผูก userId เสมอ (ไม่ส่งออกข้อมูลคนอื่น). ไม่ได้ login -> 401.
 * - ข้อมูลในไฟล์ "ตรงกับช่วงที่กรอง" (ใช้ listEntries ตัวเดียวกับหน้า /entries).
 * - UTF-8 BOM เพื่อให้ Excel เปิดภาษาไทยไม่เพี้ยน.
 */

import { NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { listEntries, type EntryKind } from "@/lib/queries";
import { satangToBaht } from "@/lib/money";
import { bkkDateKey, formatThaiDate } from "@/lib/dates";
import { parseReceiptPaths } from "@/lib/receipts";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * หนึ่งช่อง CSV: ครอบ quote เสมอ + escape quote ภายใน (กัน comma/newline/ภาษาไทย).
 * กัน CSV formula injection: ถ้าค่าขึ้นต้นด้วย = + - @ (หรือ tab/CR) ให้ใส่ ' นำหน้า
 * เพื่อให้ Excel/Sheets ตีความเป็นข้อความ ไม่ใช่สูตร (note/ชื่อหมวด เป็น free text ของผู้ใช้).
 */
function cell(value: string | number): string {
  let s = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return new Response("กรุณาเข้าสู่ระบบก่อนส่งออกข้อมูล", { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const rawType = sp.get("type");
  const type: EntryKind | undefined = rawType === "income" || rawType === "expense" ? rawType : undefined;
  const from = sp.get("from") ?? undefined;
  const to = sp.get("to") ?? undefined;
  const categoryId = sp.get("categoryId") ?? undefined;

  // กันค่าวันที่ผิดรูปแบบ -> เพิกเฉย (ไม่ throw)
  const filter = {
    type,
    categoryId: categoryId || undefined,
    from: from && DATE_RE.test(from) ? from : undefined,
    to: to && DATE_RE.test(to) ? to : undefined,
  };

  const entries = await listEntries(user.id, filter);

  const header = [
    "วันที่",
    "ประเภท",
    "หมวด",
    "จำนวนเงิน (บาท)",
    "VAT %",
    "VAT (บาท)",
    "ก่อน VAT (บาท)",
    "หมายเหตุ",
    "มีใบเสร็จ",
  ];

  const lines = [header.map(cell).join(",")];
  let totalIncome = 0;
  let totalExpense = 0;

  for (const e of entries) {
    if (e.type === "income") totalIncome += e.amountSatang;
    else totalExpense += e.amountSatang;
    const beforeVat = e.amountSatang - e.vatAmountSatang;
    lines.push(
      [
        cell(formatThaiDate(e.occurredAt)),
        cell(e.type === "income" ? "รายรับ" : "รายจ่าย"),
        cell(e.categoryName),
        cell(satangToBaht(e.amountSatang).toFixed(2)),
        cell(e.vatRate > 0 ? String(e.vatRate) : ""),
        cell(e.vatAmountSatang > 0 ? satangToBaht(e.vatAmountSatang).toFixed(2) : ""),
        cell(e.vatRate > 0 ? satangToBaht(beforeVat).toFixed(2) : ""),
        cell(e.note ?? ""),
        cell(parseReceiptPaths(e.receiptPaths).length ? "มี" : ""),
      ].join(","),
    );
  }

  // แถวสรุปท้ายไฟล์
  lines.push("");
  lines.push([cell("รวมรายรับ"), "", "", cell(satangToBaht(totalIncome).toFixed(2))].join(","));
  lines.push([cell("รวมรายจ่าย"), "", "", cell(satangToBaht(totalExpense).toFixed(2))].join(","));
  lines.push([cell("กำไรสุทธิ"), "", "", cell(satangToBaht(totalIncome - totalExpense).toFixed(2))].join(","));

  const csv = "﻿" + lines.join("\r\n");

  const today = bkkDateKey(new Date());
  const range = filter.from || filter.to ? `_${filter.from ?? "เริ่มต้น"}_ถึง_${filter.to ?? today}` : "";
  const filename = `รายการ${range}_${today}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}
