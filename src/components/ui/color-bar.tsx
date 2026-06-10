import { cn } from "@/lib/utils";

/**
 * แถบความคืบหน้าแบบกำหนดสีเอง (progress/usage) — clamp 0–100 กัน overflow.
 * tone เลือกสีฟิล: brand, income(เขียว), expense(แดง), warning(อำพัน=เตือน), neutral(เทา).
 */
export function ColorBar({
  value,
  tone = "brand",
  className,
}: {
  value: number; // 0–100 (เกินถูก clamp ที่ความกว้าง แต่สีบอกสถานะ)
  tone?: "brand" | "income" | "expense" | "warning" | "neutral";
  className?: string;
}) {
  const width = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const fill =
    tone === "income"
      ? "bg-income"
      : tone === "expense"
        ? "bg-expense"
        : tone === "warning"
          ? "bg-warning"
          : tone === "neutral"
            ? "bg-muted-foreground"
            : "bg-brand";
  return (
    <div
      className={cn("h-3 w-full overflow-hidden rounded-full bg-foreground/[0.07]", className)}
      role="progressbar"
      aria-valuenow={Math.round(width)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none", fill)}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}
