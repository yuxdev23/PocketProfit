"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * FabDock — ครอบปุ่มลอย (เพิ่มรายการ + ผู้ช่วย) พร้อม "แท็บซ่อน/แสดง" ที่แนบขอบขวาจอ.
 * แท็บโผล่ออกมาจากขอบขวา (มนเฉพาะด้านซ้าย แนบชิดขอบด้านขวา) — กดเพื่อซ่อน/แสดงปุ่มลอย
 * กันปุ่มลอยบังเนื้อหา/ปุ่มอื่นในหน้า. จำสถานะไว้ใน localStorage ให้คงค่าข้ามหน้า/รีโหลด.
 */
const STORAGE_KEY = "pp-fabs-collapsed";

export function FabDock({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  // อ่านค่าที่จำไว้ตอน mount (เริ่มต้น = แสดง เพื่อให้ตรงกับ SSR กัน hydration mismatch)
  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") setCollapsed(true);
    } catch {
      /* localStorage ใช้ไม่ได้ (private mode ฯลฯ) → ใช้ค่าเริ่มต้น */
    }
  }, []);

  function toggle() {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* เพิกเฉย */
      }
      return next;
    });
  }

  return (
    <>
      {!collapsed && children}

      {/* แท็บซ่อน/แสดง — แนบขอบขวาจอ โผล่เป็นแท็บ (มนด้านซ้าย) สไลด์เข้าจากขวา */}
      <button
        type="button"
        onClick={toggle}
        aria-label={
          collapsed
            ? "แสดงปุ่มลอย (เพิ่มรายการ / ผู้ช่วย)"
            : "ซ่อนปุ่มลอย (เพิ่มรายการ / ผู้ช่วย)"
        }
        aria-pressed={!collapsed}
        title={collapsed ? "แสดงปุ่ม" : "ซ่อนปุ่ม"}
        className="fixed bottom-[200px] right-0 z-40 flex h-14 w-7 items-center justify-center rounded-l-xl border border-r-0 border-border bg-card/95 text-muted-foreground shadow-warm backdrop-blur duration-500 transition-colors animate-in slide-in-from-right-8 fade-in hover:w-8 hover:bg-accent hover:text-foreground active:bg-accent/70 md:bottom-[152px]"
      >
        {collapsed ? (
          <ChevronLeft className="h-5 w-5" />
        ) : (
          <ChevronRight className="h-5 w-5" />
        )}
      </button>
    </>
  );
}
