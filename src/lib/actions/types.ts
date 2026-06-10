/** ผลลัพธ์มาตรฐานของ server action (แชร์ข้ามไฟล์). type-only — ไม่มี runtime. */
export type ActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> }
  | {
      ok: false;
      needConfirm: { kind: "duplicate" | "unusual"; title: string; message: string };
    };

/** มุมมองประวัติการแก้ไข (F7) สำหรับส่งข้าม boundary. */
export type RevisionView = {
  id: string;
  field: string;
  oldValue: string;
  newValue: string;
  reason: string;
  createdAt: string; // ISO
};
