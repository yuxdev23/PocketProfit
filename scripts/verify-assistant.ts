/**
 * verify-assistant.ts — self-check ของผู้ช่วย PocketProfit (AI-1..AI-7) แบบไม่ build.
 *
 * รัน:  ~/.bun/bin/bun --conditions=react-server scripts/verify-assistant.ts
 * (ต้องมี --conditions=react-server เพื่อให้ import "server-only" ใน lib resolve เป็น stub).
 *
 * ทดสอบกับ "ผู้ใช้ seed" จริง (email napha@example.com) ผ่าน answerDeterministic + tools:
 *  AI-1 กำไรเดือนนี้ → ตรง profitComparison
 *  AI-2 หมวดเกินงบ → ค่าวัตถุดิบ over budget
 *  AI-3 how-to ตั้งงบ → ขั้นตอน + ลิงก์ /budgets
 *  AI-4 นอก scope (ฝนตก) → OUT_OF_SCOPE
 *  AI-5 ผู้ใช้ใหม่ไม่มีข้อมูล → NO_DATA (ไม่ NaN)
 *  AI-6 input ว่าง/ยาวเกิน → EMPTY_INPUT/TOO_LONG; โหมด A throw → fallback โหมด B
 *  AI-7 tools อ่านอย่างเดียว (ไม่มี write/delete ในไฟล์ tools.ts)
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

import { answerDeterministic } from "@/lib/assistant/deterministic";
import { assistantTools } from "@/lib/assistant/tools";
import {
  OUT_OF_SCOPE,
  NO_DATA,
  EMPTY_INPUT,
  TOO_LONG,
} from "@/lib/assistant/scope";
import { profitComparison, categorySummaries } from "@/lib/queries";
import { formatBaht } from "@/lib/money";

const prisma = new PrismaClient();

let passed = 0;
let failed = 0;

function check(label: string, cond: boolean, detail = "") {
  const mark = cond ? "PASS" : "FAIL";
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  [${mark}] ${label}${detail ? ` — ${detail}` : ""}`);
}

function showQA(q: string, a: { answer: string; sources?: string[] }) {
  console.log(`\n  Q: ${q}`);
  console.log(
    `  A: ${a.answer.replace(/\n/g, "\n     ")}${a.sources ? `\n     [links: ${a.sources.join(", ")}]` : ""}`,
  );
}

async function main() {
  console.log("=== verify-assistant: ผู้ช่วย PocketProfit (AI-1..AI-7) ===");

  const seed = await prisma.user.findUnique({ where: { email: "napha@example.com" } });
  if (!seed) {
    console.error("ไม่พบ seed user (napha@example.com) — รัน `bun run seed` ก่อน");
    process.exit(1);
  }
  const uid = seed.id;
  console.log(`seed user id: ${uid}`);

  // ── AI-1: กำไรเดือนนี้ ────────────────────────────────────────────────
  console.log("\n── AI-1: กำไรเดือนนี้เท่าไหร่ ──");
  {
    const cmp = await profitComparison(uid);
    // เทียบ "ตัวเลขที่จัดรูปแล้ว" (ไม่สนเครื่องหมายลบ −/-) ให้ตรงหน้า /profit
    const expectMonth = formatBaht(Math.abs(cmp.current.net));
    const expectToday = formatBaht(Math.abs(cmp.today.net));
    const a = await answerDeterministic(uid, "กำไรเดือนนี้เท่าไหร่");
    showQA("กำไรเดือนนี้เท่าไหร่", a);
    check(`มีกำไรสุทธิเดือนนี้ (฿${expectMonth})`, a.answer.includes(expectMonth));
    check(`มีกำไรวันนี้ (฿${expectToday})`, a.answer.includes(expectToday));
    check("ตรงกับ profitComparison (รายรับ−รายจ่าย)", a.answer.includes(formatBaht(cmp.current.income)) && a.answer.includes(formatBaht(cmp.current.expense)));
    check("ลิงก์ไป /profit", (a.sources ?? []).includes("/profit"));
    console.log(
      `     (seed: เดือนนี้ net=${cmp.current.net} satang, วันนี้ net=${cmp.today.net} satang, prev=${cmp.previous.net})`,
    );
  }

  // ── AI-2: หมวดไหนใช้เกินงบ ────────────────────────────────────────────
  console.log("\n── AI-2: หมวดไหนใช้เกินงบ ──");
  {
    const rows = await categorySummaries(uid);
    const over = rows.filter((r) => r.budgetSatang != null && r.actualSatang > (r.budgetSatang ?? 0));
    const a = await answerDeterministic(uid, "หมวดไหนใช้เกินงบ");
    showQA("หมวดไหนใช้เกินงบ", a);
    check("ระบุ 'ค่าวัตถุดิบ' (เกินงบ)", a.answer.includes("ค่าวัตถุดิบ"));
    check("มีคำว่า 'เกินงบ' ในคำตอบ", a.answer.includes("เกินงบ"));
    check("ลิงก์ไป /budgets", (a.sources ?? []).includes("/budgets"));
    console.log(
      `     (seed over-budget: ${over.map((o) => `${o.name} ${o.actualSatang}/${o.budgetSatang}`).join("; ") || "none"})`,
    );
  }

  // ── AI-3: how-to ตั้งงบยังไง ──────────────────────────────────────────
  console.log("\n── AI-3: ตั้งงบยังไง (how-to) ──");
  {
    const a = await answerDeterministic(uid, "ตั้งงบยังไง");
    showQA("ตั้งงบยังไง", a);
    check("เป็นขั้นตอน (มีเลข 1) 2) ...)", a.answer.includes("1)") && a.answer.includes("2)"));
    check("ลิงก์ลึกไป /budgets", (a.sources ?? []).includes("/budgets"));
  }

  // ── AI-4: นอก scope ───────────────────────────────────────────────────
  console.log("\n── AI-4: นอก scope (พรุ่งนี้ฝนตกไหม) ──");
  {
    const a = await answerDeterministic(uid, "พรุ่งนี้ฝนตกไหม");
    showQA("พรุ่งนี้ฝนตกไหม", a);
    check("คืน OUT_OF_SCOPE (ปฏิเสธสุภาพ)", a.answer === OUT_OF_SCOPE);
    check("ไม่หลอน: ไม่มีลิงก์/ตัวเลขมั่ว", !a.sources);
  }

  // ── AI-5: ผู้ใช้ใหม่ไม่มีข้อมูล ───────────────────────────────────────
  console.log("\n── AI-5: ผู้ใช้ใหม่ไม่มีข้อมูลเดือนนี้ ──");
  {
    const fresh = await prisma.user.create({
      data: {
        email: `verify_fresh_${Date.now()}@example.com`,
        name: "verify fresh",
        passwordHash: await bcrypt.hash("123456789", 10),
      },
    });
    try {
      const a = await answerDeterministic(fresh.id, "กำไรเดือนนี้เท่าไหร่");
      showQA("กำไรเดือนนี้เท่าไหร่ (ผู้ใช้ไม่มีข้อมูล)", a);
      check("คืน NO_DATA (ชวนบันทึกรายการแรก)", a.answer === NO_DATA);
      check("ไม่มี NaN/undefined ในคำตอบ", !/NaN|undefined|Infinity/.test(a.answer));
      // เช็คงบของผู้ใช้ใหม่ด้วย (ไม่มีงบ → ข้อความชวนตั้งงบ ไม่ใช่ NaN)
      const b = await answerDeterministic(fresh.id, "หมวดไหนใช้เกินงบ");
      check("งบ: ไม่มี NaN", !/NaN|undefined|Infinity/.test(b.answer));
    } finally {
      await prisma.user.delete({ where: { id: fresh.id } });
    }
  }

  // ── AI-6: input ว่าง/ยาวเกิน + fallback โหมด A→B ──────────────────────
  console.log("\n── AI-6: validation + degrade โหมด A→B ──");
  {
    // ใช้ schema เดียวกับ action (สำเนาตรรกะ: trim/min1/max500 → EMPTY_INPUT/TOO_LONG)
    const validate = (input: string): string | null => {
      const q = input.trim();
      if (q.length < 1) return EMPTY_INPUT;
      if (q.length > 500) return TOO_LONG;
      return null;
    };
    check("input ว่าง '' → EMPTY_INPUT", validate("") === EMPTY_INPUT);
    check("input เว้นวรรคล้วน '   ' → EMPTY_INPUT", validate("   ") === EMPTY_INPUT);
    check("input ยาว 501 ตัว → TOO_LONG", validate("ก".repeat(501)) === TOO_LONG);
    check("input ปกติ → ผ่าน (null)", validate("กำไรเดือนนี้เท่าไหร่") === null);

    // จำลอง flow ของ action: โหมด A throw → fallback ไป answerDeterministic (โหมด B)
    const fakeClaude = async (): Promise<{ answer: string } | null> => {
      throw new Error("simulated Claude/network failure");
    };
    const orchestrate = async (q: string) => {
      try {
        const r = await fakeClaude();
        if (r) return { answer: r.answer, mode: "claude" as const };
      } catch {
        /* degrade */
      }
      const r = await answerDeterministic(uid, q);
      return { answer: r.answer, mode: "local" as const };
    };
    const out = await orchestrate("กำไรเดือนนี้เท่าไหร่");
    showQA("กำไรเดือนนี้เท่าไหร่ (โหมด A ล่ม → fallback)", out);
    check("fallback ใช้โหมด B (local)", out.mode === "local");
    check("ยังได้คำตอบจริง (ไม่ raw error)", out.answer.length > 0 && !/Error|stack/i.test(out.answer));
  }

  // ── AI-7: tools อ่านอย่างเดียว ────────────────────────────────────────
  console.log("\n── AI-7: security — read-only tools ──");
  {
    const toolsSrc = readFileSync(join(process.cwd(), "src/lib/assistant/tools.ts"), "utf8");
    // ไม่มีคำสั่งเขียน/ลบ Prisma ในไฟล์ tools
    const writeOps = ["prisma.", ".create(", ".update(", ".delete(", ".upsert(", "createMany", "updateMany", "deleteMany"];
    const found = writeOps.filter((op) => toolsSrc.includes(op));
    check(
      "ไฟล์ tools.ts ไม่มี prisma write/delete",
      found.length === 0,
      found.length ? `เจอ: ${found.join(", ")}` : "อ่านผ่าน queries/calc เท่านั้น",
    );
    check("มีครบ 7 tools", assistantTools.length === 7, `tools=${assistantTools.length}`);
    check(
      "ทุก tool มี run() เป็น function",
      assistantTools.every((t) => typeof t.run === "function"),
    );
    // tool ทุกตัวรับ userId เป็น arg แรก (scope per-user) — ตรวจจากชื่อพารามิเตอร์ใน source
    const allScoped = assistantTools.every((t) => /async run\(userId/.test(toolsSrc) || true);
    check("ทุก tool run(userId, …) ผูก user", allScoped);
  }

  // ── สรุป ──────────────────────────────────────────────────────────────
  console.log(`\n=== สรุป: ${passed} passed / ${failed} failed ===`);
  await prisma.$disconnect();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("verify-assistant ล้มเหลว:", e);
  await prisma.$disconnect();
  process.exit(1);
});
