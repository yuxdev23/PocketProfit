import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

import { getCurrentUser } from "@/lib/auth";
import { UPLOAD_DIR } from "@/lib/actions/upload";

// เสิร์ฟไฟล์แนบ (รูปสลิป/ใบเสร็จ) แบบ "ส่วนตัว" — ต้องล็อกอิน + เป็นเจ้าของไฟล์เท่านั้น (F7, privacy).
// ไฟล์เก็บนอก public/ จึงไม่ถูกเสิร์ฟ static; ทุกคำขอผ่าน handler นี้ที่ตรวจสิทธิ์ก่อนเสมอ.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONTENT_TYPE: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  svg: "image/svg+xml", // ของเก่า/seed เท่านั้น (อัปโหลดใหม่ไม่รับแล้ว) — เสิร์ฟใต้ CSP sandbox
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("ต้องเข้าสู่ระบบ", { status: 401 });

  const segments = (await params).path ?? [];
  // ต้องเป็น [userId, ...] และ userId ต้องตรงกับผู้ใช้ที่ล็อกอิน (ดูได้เฉพาะไฟล์ตัวเอง)
  if (segments.length < 2 || segments[0] !== user.id) {
    return new NextResponse("ไม่มีสิทธิ์เข้าถึง", { status: 403 });
  }
  // กัน path traversal: ห้ามมี .. หรือ separator ในแต่ละ segment
  if (segments.some((s) => !s || s === "." || s === ".." || s.includes("/") || s.includes("\\"))) {
    return new NextResponse("คำขอไม่ถูกต้อง", { status: 400 });
  }

  const filePath = path.join(UPLOAD_DIR, ...segments);
  // ยืนยันซ้ำว่ายังอยู่ใต้ UPLOAD_DIR จริง (กัน traversal หลุด)
  const root = path.resolve(UPLOAD_DIR);
  if (!path.resolve(filePath).startsWith(root + path.sep)) {
    return new NextResponse("คำขอไม่ถูกต้อง", { status: 400 });
  }

  let body: Blob;
  try {
    body = new Blob([await readFile(filePath)]);
  } catch {
    return new NextResponse("ไม่พบไฟล์", { status: 404 });
  }

  const ext = (segments[segments.length - 1].split(".").pop() ?? "").toLowerCase();
  return new NextResponse(body, {
    headers: {
      "Content-Type": CONTENT_TYPE[ext] ?? "application/octet-stream",
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      // กันสคริปต์ใน SVG ทำงาน (defense-in-depth) + ห้ามโหลด resource อื่น
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
