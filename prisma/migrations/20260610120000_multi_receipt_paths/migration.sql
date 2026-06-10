-- รองรับแนบรูปหลายไฟล์ต่อรายการ (F7): receiptPath (path เดี่ยว) -> receiptPaths (JSON array)
-- คงข้อมูลเดิม: รูปที่แนบไว้แล้วถูกแปลงเป็น array 1 สมาชิก เช่น "/uploads/x.png" -> ["/uploads/x.png"]
ALTER TABLE "Entry" ADD COLUMN "receiptPaths" TEXT;
UPDATE "Entry" SET "receiptPaths" = '["' || "receiptPath" || '"]' WHERE "receiptPath" IS NOT NULL AND "receiptPath" <> '';
ALTER TABLE "Entry" DROP COLUMN "receiptPath";
