-- F2.2: งบประมาณ "แยกตามเดือน" (effective-dated + carry-forward)
-- ย้ายจาก Category.monthlyBudgetSatang (global ค่าเดียว) -> ตาราง CategoryBudget (ต่อเดือน)

-- 1) ตารางงบรายเดือน
CREATE TABLE "CategoryBudget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "amountSatang" INTEGER,
    CONSTRAINT "CategoryBudget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CategoryBudget_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CategoryBudget_categoryId_month_key" ON "CategoryBudget"("categoryId", "month");
CREATE INDEX "CategoryBudget_userId_idx" ON "CategoryBudget"("userId");
CREATE INDEX "CategoryBudget_categoryId_idx" ON "CategoryBudget"("categoryId");

-- 2) ย้ายข้อมูลเดิม: ตั้ง effective จาก "1970-01" (sentinel ก่อนทุกเดือนจริง)
--    → carry-forward ทำให้ทุกเดือนยังเห็นงบเดิมเป๊ะ ณ ตอน migrate; การแก้เดือนนี้ค่อยแยกอดีต
INSERT INTO "CategoryBudget" ("id", "userId", "categoryId", "month", "amountSatang")
SELECT lower(hex(randomblob(16))), "userId", "id", '1970-01', "monthlyBudgetSatang"
FROM "Category"
WHERE "monthlyBudgetSatang" IS NOT NULL;

-- 3) เลิกใช้คอลัมน์งบ global เดิม
ALTER TABLE "Category" DROP COLUMN "monthlyBudgetSatang";
