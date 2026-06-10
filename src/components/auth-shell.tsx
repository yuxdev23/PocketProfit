import type { CSSProperties } from "react";

import { BrandMark } from "@/components/brand-mark";

const TAGLINE_1 = "รู้กำไรร้าน ทุกวัน — จดรายรับ-รายจ่าย";
const TAGLINE_2 = "ดูกำไรง่ายๆ อุ่นใจทุกวัน";

// ตัดเป็น grapheme cluster (สระ/วรรณยุกต์ติดพยัญชนะ ไม่แตกเป็นกลุ่มเพี้ยน) เพื่อ reveal ทีละพยางค์
const segmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter("th", { granularity: "grapheme" })
    : null;

function toGraphemes(text: string): string[] {
  return segmenter
    ? Array.from(segmenter.segment(text), (p) => p.segment)
    : Array.from(text);
}

const TAGLINE_1_LEN = toGraphemes(TAGLINE_1).length;

/**
 * แสดงข้อความทีละพยางค์ (grapheme) ซ้าย→ขวา ด้วย opacity wave.
 * startIndex = ลำดับเริ่ม (ใช้ต่อจังหวะข้ามบรรทัดให้ไหลต่อเนื่อง).
 */
function RevealLine({
  text,
  startIndex,
  baseDelay,
  step,
}: {
  text: string;
  startIndex: number;
  baseDelay: number;
  step: number;
}) {
  return (
    <>
      {toGraphemes(text).map((g, i) => (
        <span
          key={i}
          className="animate-syllable-in"
          style={{ animationDelay: `${(baseDelay + (startIndex + i) * step).toFixed(3)}s` }}
        >
          {g}
        </span>
      ))}
    </>
  );
}

/** ฿ ลอยขึ้นเป็นฉากหลัง (ambient) — ตำแหน่ง/จังหวะต่างกันให้ดูเป็นธรรมชาติ ไม่ซ้ำเป็นจังหวะ */
const COINS: ReadonlyArray<{
  left: string;
  size: string;
  delay: string;
  dur: string;
  op: number;
}> = [
  { left: "9%", size: "1.5rem", delay: "0.9s", dur: "7.6s", op: 0.4 },
  { left: "27%", size: "1rem", delay: "2.7s", dur: "8.8s", op: 0.26 },
  { left: "54%", size: "1.25rem", delay: "1.5s", dur: "6.9s", op: 0.34 },
  { left: "73%", size: "0.9rem", delay: "3.5s", dur: "9.3s", op: 0.24 },
  { left: "89%", size: "1.4rem", delay: "2s", dur: "7.4s", op: 0.36 },
];

/**
 * เปลือกหน้า auth (login/signup) — ความประทับใจแรกของ "PocketProfit".
 * Entrance "แสงอรุณ + กำไรพุ่ง": แสงอรุณเรืองขึ้น → รัศมีโลโก้กางออก → ฿ เด้ง + วาบทอง
 * → ชื่อ/แท็กไลน์/การ์ด ไล่ขึ้นทีละชิ้น → ฿ ลอยขึ้นเบา ๆ เป็นฉากหลัง.
 * (transform/opacity ล้วน, เคารพ prefers-reduced-motion ผ่าน globals.css)
 */
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <main className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-background px-5 py-10">
      {/* แสงอรุณเรืองขึ้นหลังโลโก้ */}
      <div
        aria-hidden
        className="animate-glow-in pointer-events-none absolute left-1/2 top-[40%] z-0 h-[120vw] max-h-[560px] w-[120vw] max-w-[560px] rounded-full"
        style={{
          background:
            "radial-gradient(circle at center, hsl(var(--accent-brand) / 0.22), hsl(var(--accent-brand) / 0.06) 42%, transparent 70%)",
        }}
      />

      {/* ฿ ลอยขึ้นเบา ๆ เป็นฉากหลัง */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        {COINS.map((c, i) => (
          <span
            key={i}
            className="animate-coin-float absolute bottom-6 select-none font-bold text-brand"
            style={
              {
                left: c.left,
                fontSize: c.size,
                "--coin-delay": c.delay,
                "--coin-duration": c.dur,
                "--coin-opacity": String(c.op),
              } as CSSProperties
            }
          >
            ฿
          </span>
        ))}
      </div>

      <div className="relative z-10 w-full max-w-sm">
        {/* แบรนด์ */}
        <div className="mb-6 flex flex-col items-center text-center">
          <span
            className="animate-fade-slide-up relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-3xl border border-border bg-card shadow-warm-sm"
            style={{ animationDelay: "0.05s" }}
          >
            <BrandMark className="h-10 w-10" animate />
            {/* วาบทองพาดผ่านโลโก้ */}
            <span
              aria-hidden
              className="animate-logo-shimmer pointer-events-none absolute inset-0"
              style={{
                background:
                  "linear-gradient(115deg, transparent 35%, hsl(45 95% 85% / 0.65) 50%, transparent 65%)",
              }}
            />
          </span>
          <h1
            className="animate-fade-slide-up mt-3 text-2xl font-bold tracking-tight text-foreground"
            style={{ animationDelay: "0.7s" }}
          >
            PocketProfit
          </h1>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            <RevealLine text={TAGLINE_1} startIndex={0} baseDelay={0.78} step={0.022} />
            <br />
            <RevealLine text={TAGLINE_2} startIndex={TAGLINE_1_LEN} baseDelay={0.78} step={0.022} />
          </p>
        </div>

        {/* การ์ด */}
        <div
          className="animate-fade-slide-up rounded-3xl border border-border/70 bg-card p-6 shadow-warm"
          style={{ animationDelay: "0.9s" }}
        >
          <div className="mb-5">
            <h2 className="text-lg font-bold text-foreground">{title}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
          </div>
          {children}
        </div>

        <p
          className="animate-fade-slide-up mt-5 text-center text-xs text-muted-foreground"
          style={{ animationDelay: "1s" }}
        >
          ข้อมูลร้านของคุณเก็บเป็นส่วนตัว ปลอดภัย 🌤️
        </p>
      </div>
    </main>
  );
}
