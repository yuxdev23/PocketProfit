import type { Metadata } from "next";
import { NotebookPen } from "lucide-react";

import { requireUser } from "@/lib/auth";
import { getNote, type NoteScope } from "@/lib/queries";
import {
  currentMonthKey,
  todayDateKey,
  recentMonths,
  monthKeyToThai,
  formatThaiDateTime,
} from "@/lib/dates";
import { NotesWorkspace, type MonthChoice } from "@/components/notes-workspace";

export const metadata: Metadata = {
  title: "โน้ต / บันทึกย่อ",
};

// โน้ตผูกกับวัน/เดือนปัจจุบัน (เวลาไทย) — คำนวณสดทุก request
export const dynamic = "force-dynamic";

export default async function NotesPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string; day?: string; month?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;

  const scope: NoteScope =
    sp.scope === "daily" ? "daily" : sp.scope === "monthly" ? "monthly" : "global";

  const today = todayDateKey();
  const curMonth = currentMonthKey();

  // วัน/เดือนที่เลือก — validate รูปแบบ + กันวันอนาคต, ค่าเริ่มต้น = วันนี้/เดือนนี้
  const day = sp.day && /^\d{4}-\d{2}-\d{2}$/.test(sp.day) && sp.day <= today ? sp.day : today;
  const month = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : curMonth;

  const scopeKey = scope === "daily" ? day : scope === "monthly" ? month : "";
  const note = await getNote(user.id, scope, scopeKey);

  // ตัวเลือกเดือน = 12 เดือนล่าสุด; ถ้าเดือนที่เลือก (จาก URL) อยู่นอกช่วง ให้เติมเข้าไปด้วย
  let monthOptions: MonthChoice[] = recentMonths(12);
  if (!monthOptions.some((m) => m.value === month)) {
    monthOptions = [{ value: month, label: monthKeyToThai(month) }, ...monthOptions];
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-lg font-bold text-foreground">
          <NotebookPen className="h-5 w-5 text-brand" />
          โน้ต / บันทึกย่อ
        </h1>
        <p className="text-sm text-muted-foreground">
          จดโน้ตได้ 1 หน้าต่อ “รวม”, ต่อวัน หรือ ต่อเดือน — เลือกขอบเขตแล้วพิมพ์ได้เลย
        </p>
      </header>

      <NotesWorkspace
        scope={scope}
        scopeKey={scopeKey}
        day={day}
        month={month}
        today={today}
        monthOptions={monthOptions}
        noteBody={note?.body ?? ""}
        updatedAtLabel={note ? formatThaiDateTime(note.updatedAt) : null}
      />
    </div>
  );
}
