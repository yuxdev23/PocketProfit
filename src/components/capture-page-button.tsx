"use client";

import { useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";

/**
 * ปุ่ม "Capture หน้านี้" (FAB) — ใช้แทนปุ่ม "เพิ่มรายการ" ในหน้าสรุปอ่านอย่างเดียว
 * (กำไรสุทธิ / ภาษีมูลค่าเพิ่ม). จับภาพ "ทั้งหน้า" (เนื้อหาใน [data-capture-root])
 * เป็น PNG แล้วดาวน์โหลด เพื่อเก็บ/แชร์ไลน์-โซเชียลได้.
 *
 * - โหลด html-to-image แบบ dynamic → ไม่ถ่วง bundle หน้าอื่น
 * - รอฟอนต์ไทยพร้อม + เรนเดอร์ซ้ำ 1 รอบ กัน Safari ออกภาพเปล่า/ฟอนต์ไม่ติด
 * - ปุ่มนี้อยู่นอก [data-capture-root] จึงไม่ติดมาในภาพ
 */
export function CapturePageButton({
  label,
  fileBase,
}: {
  label: string;
  fileBase: string;
}) {
  const [busy, setBusy] = useState(false);

  async function handleCapture() {
    if (busy) return;

    const node = document.querySelector<HTMLElement>("[data-capture-root]");
    if (!node) {
      toast.error("ไม่พบเนื้อหาที่จะ capture — ลองรีโหลดหน้าแล้วลองใหม่อีกครั้ง");
      return;
    }

    setBusy(true);
    let wrapper: HTMLElement | null = null;
    let clone: HTMLElement | null = null;
    try {
      const { toPng } = await import("html-to-image");

      // พื้นหลังตามธีมปัจจุบัน (light/dark) เพื่อไม่ให้ภาพออกมาพื้นโปร่งใส
      const backgroundColor =
        getComputedStyle(document.body).backgroundColor || "#ffffff";

      // รอฟอนต์ไทยพร้อมก่อน เพื่อฝังฟอนต์ลงภาพให้คมชัด
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }

      // จับภาพจาก "clone" ของเนื้อหา ไม่ใช่ตัวจริง — ปลดซ่อนแถบแบรนด์ ([data-capture-only])
      // เฉพาะใน clone จึงได้โลโก้ในภาพ โดยหน้าจอจริงไม่กระพริบ/ไม่ขยับ
      clone = node.cloneNode(true) as HTMLElement;
      clone
        .querySelectorAll<HTMLElement>("[data-capture-only]")
        .forEach((el) => {
          el.style.display = "";
        });
      clone.style.margin = "0";

      // วาง clone ไว้ใน "wrapper" ที่ถูกดันออกนอกจอ — ตัว clone ที่จะจับภาพคงตำแหน่ง
      // static ปกติไว้. สำคัญมาก: ห้ามตั้ง position:fixed/left ที่ "ตัว node ที่จับภาพ"
      // โดยตรง เพราะ html-to-image จะ inline ตำแหน่งนั้นลงในภาพ → เนื้อหาหลุดออกนอกกรอบ
      // เหลือแต่พื้นหลัง = ภาพดำล้วน (dark) / ขาวล้วน (light).
      wrapper = document.createElement("div");
      wrapper.setAttribute("aria-hidden", "true");
      wrapper.style.position = "fixed";
      wrapper.style.top = "0";
      wrapper.style.left = "-99999px";
      wrapper.style.width = `${node.offsetWidth}px`;
      wrapper.style.pointerEvents = "none";
      wrapper.appendChild(clone);
      document.body.appendChild(wrapper);

      // โลโก้แบรนด์มี ฿ เป็น SVG <text> ที่ใช้เว็บฟอนต์ (IBM Plex Sans Thai). html-to-image
      // rasterize ผ่าน SVG-as-image ซึ่ง "โหลดเว็บฟอนต์ไม่ได้" → ตัว ฿ หายไป (เส้นรัศมีที่เป็น
      // เรขาคณิตยังอยู่). แก้ใน clone: บังคับใช้ system font + ใส่ fill ตรง ๆ (อ่านสีตามธีมจาก
      // clone ที่อยู่ใน DOM แล้ว — class-based fill ไม่ถูก inline จึงตกเป็นสีดำมองไม่เห็นบนพื้นมืด).
      // จำกัดเฉพาะ <text> ในแถบแบรนด์ ไม่แตะ <text> ของกราฟ (recharts) ที่แสดงผลปกติอยู่แล้ว.
      clone
        .querySelectorAll<SVGTextElement>("[data-capture-only] svg text")
        .forEach((t) => {
          const fill = getComputedStyle(t).fill;
          if (fill) {
            t.setAttribute("fill", fill);
            t.style.fill = fill;
          }
          t.setAttribute("font-family", "sans-serif");
          t.style.fontFamily = "sans-serif";
        });

      const options = { backgroundColor, pixelRatio: 2, cacheBust: true };
      // รอบแรก "อุ่นเครื่อง" (Safari มักออกภาพเปล่า/ฟอนต์ไม่ติดรอบแรก) แล้วใช้รอบสอง
      await toPng(clone, options);
      const dataUrl = await toPng(clone, options);

      const link = document.createElement("a");
      link.download = `${fileBase}-${todayStamp()}.png`;
      link.href = dataUrl;
      link.click();

      toast.success("บันทึกภาพหน้านี้แล้ว — เปิดได้ในที่ดาวน์โหลด/อัลบั้ม");
    } catch (err) {
      console.error("[capture] failed:", err);
      toast.error("Capture ไม่สำเร็จ ลองอีกครั้ง หรือถ่ายภาพหน้าจอแทนได้");
    } finally {
      if (wrapper?.parentNode) wrapper.parentNode.removeChild(wrapper);
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCapture}
      disabled={busy}
      aria-label={label}
      aria-busy={busy}
      className="fixed bottom-[72px] right-4 z-40 flex h-14 items-center gap-2 rounded-full bg-brand px-5 text-brand-foreground shadow-lg transition-transform hover:scale-105 active:scale-95 disabled:cursor-wait disabled:opacity-80 md:bottom-6"
    >
      {busy ? (
        <Loader2 className="h-6 w-6 animate-spin" />
      ) : (
        <Camera className="h-6 w-6" />
      )}
      <span className="pr-1 text-base font-semibold">
        {busy ? "กำลัง capture…" : label}
      </span>
    </button>
  );
}

/** YYYY-MM-DD ตามเวลาเครื่อง — ใช้ตั้งชื่อไฟล์ภาพ */
function todayStamp() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
