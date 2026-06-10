import { cn } from "@/lib/utils";

// รัศมีดวงอาทิตย์ 8 เส้น เรียง "ตามเข็มนาฬิกาเริ่มจากบน" เพื่อให้ animate ไล่รอบวงสวย ๆ
const RAYS: ReadonlyArray<readonly [number, number, number, number]> = [
  [16, 2.5, 16, 5.5], // บน
  [25.7, 6.3, 23.6, 8.4], // บน-ขวา
  [26.5, 16, 29.5, 16], // ขวา
  [23.6, 23.6, 25.7, 25.7], // ล่าง-ขวา
  [16, 26.5, 16, 29.5], // ล่าง
  [8.4, 23.6, 6.3, 25.7], // ล่าง-ซ้าย
  [2.5, 16, 5.5, 16], // ซ้าย
  [6.3, 6.3, 8.4, 8.4], // บน-ซ้าย
];

/**
 * โลโก้ "PocketProfit" — เหรียญ/ดวงตรา (coin) วาดด้วย SVG.
 * วงในเขียวมรกต + รัศมีรอบ สื่อถึงเงิน/กำไรและความสดใหม่.
 * `animate` (ใช้เฉพาะหน้า login): รัศมีกางออกทีละเส้นรอบวง + ฿ เด้งเข้ากลาง.
 */
export function BrandMark({
  className,
  animate = false,
}: {
  className?: string;
  animate?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("h-7 w-7", className)}
      role="img"
      aria-label="PocketProfit"
      fill="none"
    >
      {/* รัศมีดวงอาทิตย์ */}
      <g
        stroke="hsl(158 78% 44%)"
        strokeWidth="2.1"
        strokeLinecap="round"
        opacity="0.9"
      >
        {RAYS.map(([x1, y1, x2, y2], i) => (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            className={animate ? "animate-ray-in" : undefined}
            style={animate ? { animationDelay: `${0.2 + i * 0.05}s` } : undefined}
          />
        ))}
      </g>
      {/* ไม่มีวงเหรียญ — รัศมีล้อมรอบ + ฿ ลอยตรงกลาง (ตามแบบที่เลือก) */}
      <text
        x="16"
        y="20.4"
        textAnchor="middle"
        fontSize="11"
        fontWeight="700"
        className={cn("fill-[#B8860B] dark:fill-[#EBD08A]", animate && "animate-baht-pop")}
        style={{ fontFamily: "var(--font-thai), sans-serif" }}
      >
        ฿
      </text>
    </svg>
  );
}

/** Wordmark = โลโก้ + ชื่อแอป "PocketProfit" + แท็กไลน์ สำหรับหัวแอป */
export function BrandWordmark({
  className,
  showTagline = true,
}: {
  className?: string;
  showTagline?: boolean;
}) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <BrandMark className="h-8 w-8 shrink-0" />
      <span className="flex flex-col leading-none">
        <span className="text-base font-bold tracking-tight text-foreground">
          PocketProfit
        </span>
        {showTagline ? (
          <span className="mt-0.5 text-[10px] font-medium tracking-[0.06em] text-brand">
            รู้กำไรร้าน ทุกวัน
          </span>
        ) : null}
      </span>
    </span>
  );
}
