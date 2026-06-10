import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // รองรับแนบรูปสลิป/ใบเสร็จหลายไฟล์ต่อรายการ (F7). ดีฟอลต์ของ Next คือ 1 MB
      // ทำให้บันทึก "ค้าง/ไม่สำเร็จ" เมื่อแนบหลายรูป — ขยายเพดานให้พอกับหลายรูป
      // (ฝั่งฟอร์มมี guard จำกัดขนาดรวม ~45 MB อีกชั้น กัน payload ใหญ่เกินไป).
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
