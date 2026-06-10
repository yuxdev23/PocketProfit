"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  ListChecks,
  PieChart,
  TrendingUp,
  MoreHorizontal,
  Target,
  Package,
  Repeat,
  Tags,
  Receipt,
  Download,
  LogOut,
  UserRound,
  Trophy,
  NotebookPen,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { logout } from "@/app/(auth)/actions";
import { BrandWordmark } from "@/components/brand-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PRIMARY = [
  { href: "/", label: "วันนี้", icon: CalendarDays },
  { href: "/entries", label: "รายการ", icon: ListChecks },
  { href: "/budgets", label: "งบ", icon: PieChart },
  { href: "/profit", label: "กำไร", icon: TrendingUp },
] as const;

const MORE = [
  { href: "/notes", label: "โน้ต / บันทึกย่อ", icon: NotebookPen },
  { href: "/goals", label: "เป้าเดือนนี้", icon: Target },
  { href: "/products", label: "บริหารกำไรขั้นต้นของสินค้า", icon: Package },
  { href: "/recurring", label: "ค่าใช้จ่ายประจำ", icon: Repeat },
  { href: "/categories", label: "จัดการหมวด", icon: Tags },
  { href: "/vat", label: "ภาษี (VAT)", icon: Receipt },
  { href: "/export", label: "ส่งออก/Export", icon: Download },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * ปุ่มลัด → หน้า "อันดับกำไรดี" (/top) — วางที่ขวาบนของ navbar ถัดจากปุ่มสลับธีม
 * (ไล่จากขวาไปซ้าย: เมนูผู้ใช้ · ธีม · อันดับกำไรดี). สไตล์เดียวกับปุ่มไอคอนอื่นบนแถบ.
 */
function TopRankLink({ className }: { className?: string }) {
  const pathname = usePathname();
  const active = isActive(pathname, "/top");
  return (
    <Link
      href="/top"
      aria-label="อันดับกำไรดี (หมวด/สินค้า)"
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-full border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-90",
        active
          ? "border-brand/40 bg-brand/15 text-brand"
          : "border-border/70 bg-card/60 text-foreground/80 hover:bg-accent hover:text-accent-foreground",
        className,
      )}
    >
      <Trophy className="h-[18px] w-[18px]" strokeWidth={active ? 2.5 : 2} />
    </Link>
  );
}

/** Top nav (≥768px) — wordmark + tabs + theme toggle + user menu */
export function TopNav({ email }: { email: string }) {
  const pathname = usePathname();
  const moreActive =
    isActive(pathname, "/more") || MORE.some((m) => isActive(pathname, m.href));
  return (
    <header className="sticky top-0 z-30 hidden border-b border-border/70 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70 md:block">
      <div className="mx-auto flex h-16 max-w-5xl items-center gap-1 px-4">
        <Link href="/" className="mr-3 shrink-0" aria-label="PocketProfit">
          <BrandWordmark />
        </Link>
        <nav className="flex items-center gap-1">
          {PRIMARY.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-brand/15 text-brand"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={active ? 2.5 : 2} />
                {item.label}
              </Link>
            );
          })}
          {/* ยุบเมนูรองทั้งหมดเป็น "เพิ่มเติม" → /more เพื่อให้แถบไม่แน่น + label 1 บรรทัด */}
          <Link
            href="/more"
            aria-current={moreActive ? "page" : undefined}
            className={cn(
              "flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-sm font-medium transition-colors",
              moreActive
                ? "bg-brand/15 text-brand"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <MoreHorizontal className="h-4 w-4" strokeWidth={moreActive ? 2.5 : 2} />
            เพิ่มเติม
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <TopRankLink />
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="เมนูผู้ใช้"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-brand/10 text-brand transition-all hover:bg-brand/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-90"
              >
                <UserRound className="h-[18px] w-[18px]" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="truncate font-normal">
                <span className="block text-xs text-muted-foreground">เข้าสู่ระบบเป็น</span>
                <span className="truncate font-medium text-foreground">{email}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <form action={logout} className="w-full">
                  <button type="submit" className="flex w-full items-center gap-2 text-expense">
                    <LogOut className="h-4 w-4" />
                    ออกจากระบบ
                  </button>
                </form>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

/** Mobile header (< 768px) — wordmark + theme toggle, sticky */
export function MobileHeader() {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border/70 bg-background/85 px-4 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-background/70 md:hidden">
      <Link href="/" aria-label="PocketProfit">
        <BrandWordmark />
      </Link>
      <div className="flex items-center gap-2">
        <TopRankLink />
        <ThemeToggle />
      </div>
    </header>
  );
}

/** Bottom tab bar (มือถือ < 768px) — 4 ช่อง + "เพิ่มเติม" ลิงก์ไปหน้า /more */
export function BottomNav() {
  const pathname = usePathname();
  const moreActive =
    isActive(pathname, "/more") || MORE.some((m) => isActive(pathname, m.href));
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75 md:hidden">
      <div
        className="mx-auto grid max-w-md grid-cols-5 px-2 pt-1.5"
        style={{ paddingBottom: "max(0.375rem, env(safe-area-inset-bottom))" }}
      >
        {PRIMARY.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className="group flex flex-col items-center justify-center gap-1 rounded-2xl py-1.5 focus-visible:outline-none"
            >
              <span
                className={cn(
                  "relative flex h-9 w-14 items-center justify-center rounded-full transition-colors duration-300",
                  active
                    ? "bg-brand/15 text-brand"
                    : "text-muted-foreground group-hover:text-foreground group-focus-visible:ring-2 group-focus-visible:ring-ring",
                )}
              >
                <Icon
                  className={cn("h-[22px] w-[22px] transition-transform duration-300", active && "scale-105")}
                  strokeWidth={active ? 2.6 : 2}
                />
              </span>
              <span
                className={cn(
                  "text-[11px] font-medium transition-colors duration-200",
                  active ? "text-brand" : "text-muted-foreground group-hover:text-foreground",
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
        <Link
          href="/more"
          aria-current={moreActive ? "page" : undefined}
          className="group flex flex-col items-center justify-center gap-1 rounded-2xl py-1.5 focus-visible:outline-none"
        >
          <span
            className={cn(
              "relative flex h-9 w-14 items-center justify-center rounded-full transition-colors duration-300",
              moreActive
                ? "bg-brand/15 text-brand"
                : "text-muted-foreground group-hover:text-foreground group-focus-visible:ring-2 group-focus-visible:ring-ring",
            )}
          >
            <MoreHorizontal
              className={cn("h-[22px] w-[22px] transition-transform duration-300", moreActive && "scale-105")}
              strokeWidth={moreActive ? 2.6 : 2}
            />
          </span>
          <span
            className={cn(
              "text-[11px] font-medium transition-colors duration-200",
              moreActive ? "text-brand" : "text-muted-foreground group-hover:text-foreground",
            )}
          >
            เพิ่มเติม
          </span>
        </Link>
      </div>
    </nav>
  );
}
