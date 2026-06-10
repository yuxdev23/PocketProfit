/**
 * QA test script for AI-1..AI-7 acceptance items.
 * Run: bun run scripts/test-assistant-qa.ts
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const NAPHA_ID = "cmpwt7eky0000sg4f3netizgj";

function bkkMonthRange(monthKey: string) {
  const [y, m] = monthKey.split("-").map(Number);
  const gte = new Date(Date.UTC(y, m - 1, 1) - 7 * 60 * 60 * 1000);
  const lt = new Date(Date.UTC(y, m, 1) - 7 * 60 * 60 * 1000);
  return { gte, lt };
}

function currentMonthKey() {
  const now = new Date();
  const bkk = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const y = bkk.getUTCFullYear();
  const m = String(bkk.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function prevMonthKey(mk: string) {
  const [y, m] = mk.split("-").map(Number);
  const prev = new Date(y, m - 2, 1);
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
}

async function sumByType(userId: string, range: { gte: Date; lt: Date }) {
  const rows = await db.entry.groupBy({
    by: ["type"],
    where: { userId, deletedAt: null, occurredAt: { gte: range.gte, lt: range.lt } },
    _sum: { amountSatang: true },
  });
  let income = 0, expense = 0;
  for (const r of rows) {
    if (r.type === "income") income = r._sum.amountSatang ?? 0;
    else expense = r._sum.amountSatang ?? 0;
  }
  return { income, expense, net: income - expense };
}

async function main() {
  const mk = currentMonthKey();
  const prevMk = prevMonthKey(mk);

  console.log("=== Current month key:", mk, "===");

  // AI-1: Profit data for napha
  const curRange = bkkMonthRange(mk);
  const prevRange = bkkMonthRange(prevMk);

  const cur = await sumByType(NAPHA_ID, curRange);
  const prev = await sumByType(NAPHA_ID, prevRange);

  // Today
  const now = new Date();
  const bkkNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const todayStart = new Date(Date.UTC(bkkNow.getUTCFullYear(), bkkNow.getUTCMonth(), bkkNow.getUTCDate()) - 7 * 60 * 60 * 1000);
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const today = await sumByType(NAPHA_ID, { gte: todayStart, lt: todayEnd });

  console.log("\n--- AI-1: Profit for napha (cross-check vs /profit page) ---");
  console.log(`Month income: ฿${cur.income/100} expense: ฿${cur.expense/100} net: ฿${cur.net/100}`);
  console.log(`Prev month (${prevMk}): net: ฿${prev.net/100}`);
  console.log(`Today: net: ฿${today.net/100}`);
  console.log(`monthHasData: ${cur.income > 0 || cur.expense > 0}`);
  const changePct = prev.net === 0 ? null : Math.round((cur.net - prev.net) / Math.abs(prev.net) * 100);
  console.log(`changePct: ${changePct}% direction: ${cur.net > prev.net ? 'up' : cur.net < prev.net ? 'down' : 'flat'}`);

  // AI-2: Budget status for napha
  console.log("\n--- AI-2: Budget status for napha (cross-check vs /budgets) ---");
  const cats = await db.category.findMany({
    where: { userId: NAPHA_ID, archived: false },
  });
  const sums = await db.entry.groupBy({
    by: ["categoryId"],
    where: { userId: NAPHA_ID, deletedAt: null, occurredAt: { gte: curRange.gte, lt: curRange.lt } },
    _sum: { amountSatang: true },
  });
  const spentByCat = new Map<string, number>();
  for (const s of sums) {
    if (s.categoryId) spentByCat.set(s.categoryId, s._sum.amountSatang ?? 0);
  }
  // งบ effective-dated (F2.2): carry-forward เอาค่าเดือนล่าสุดที่ <= เดือนนี้
  const budgetRows = await db.categoryBudget.findMany({
    where: { userId: NAPHA_ID, month: { lte: mk } },
    orderBy: { month: "asc" },
    select: { categoryId: true, amountSatang: true },
  });
  const budgetByCat = new Map<string, number | null>();
  for (const b of budgetRows) budgetByCat.set(b.categoryId, b.amountSatang);
  let anyBudgetSet = false;
  for (const c of cats) {
    const cBudget = budgetByCat.get(c.id) ?? null;
    if (cBudget && cBudget > 0) {
      anyBudgetSet = true;
      const actual = spentByCat.get(c.id) ?? 0;
      const budget = cBudget;
      const pct = Math.round((actual / budget) * 100);
      const over = actual > budget;
      const near = !over && pct >= 80;
      console.log(`  ${c.name}: used=฿${actual/100} budget=฿${budget/100} pct=${pct}% over=${over} near=${near}`);
    }
  }
  console.log(`anyBudgetSet: ${anyBudgetSet}`);

  // AI-5: New user test
  console.log("\n--- AI-5: New user scenario ---");
  const recentUsers = await db.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    include: { _count: { select: { entries: true } } }
  });
  for (const u of recentUsers) {
    if (u.email !== "napha@example.com") {
      const userCur = await sumByType(u.id, curRange);
      const hasData = userCur.income > 0 || userCur.expense > 0;
      console.log(`User ${u.email}: entries=${u._count.entries} monthHasData=${hasData} monthNet=฿${userCur.net/100}`);
      if (!hasData) {
        console.log(`  -> monthHasData=false → assistant should return NO_DATA (not NaN)`);
        break;
      }
    }
  }

  console.log("\n=== Done ===");
}

main()
  .then(() => db.$disconnect())
  .catch((e) => { console.error(e); db.$disconnect(); process.exit(1); });
