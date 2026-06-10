import type { Metadata } from "next";
import Link from "next/link";
import {
  ChevronRight,
  PieChart,
  NotebookPen,
  BarChart3,
  Target,
  Package,
  Repeat,
  Tags,
  Receipt,
  Download,
  LogOut,
  type LucideIcon,
} from "lucide-react";

import { requireUser } from "@/lib/auth";
import { logout } from "@/app/(auth)/actions";
import { Card } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = {
  title: "เพิ่มเติม",
};

export const dynamic = "force-dynamic";

type HubLink = {
  href: string;
  label: string;
  desc: string;
  icon: LucideIcon;
};

type HubGroup = {
  title: string;
  links: readonly HubLink[];
};

/**
 * หน้า "เพิ่มเติม" — ศูนย์รวมเครื่องมือรอง ทุกอย่างที่ไม่ได้อยู่บนแท็บหลัก
 * (เป้าหมาย / สินค้า / ค่าใช้จ่ายประจำ / หมวด / VAT / ส่งออก) จัดเป็นกลุ่มการ์ด
 * ลิงก์เดียวต่อแถว พร้อมไอคอน + ชื่อ + คำอธิบายสั้น ๆ ให้กดง่ายจากมือถือ.
 * อิงแพตเทิร์น shop-expenses/more แต่ใช้คอมโพเนนต์ & โทนอุ่นของ PocketProfit.
 */
/** เมนูเด่นบนสุดของหน้า "เพิ่มเติม" — โน้ต/บันทึกย่อ (แสดงเดี่ยว เหนือทุกกลุ่ม) */
const NOTES_LINK: HubLink = {
  href: "/notes",
  label: "โน้ต / บันทึกย่อ",
  desc: "จดโน้ตได้ 1 หน้าต่อ รวม / รายวัน / รายเดือน เลือกขอบเขตได้",
  icon: NotebookPen,
};

const GROUPS: readonly HubGroup[] = [
  {
    title: "เป้าหมาย & กำไร",
    links: [
      {
        href: "/goals",
        label: "เป้าเดือนนี้",
        desc: "ตั้งเป้ารายได้และเพดานรายจ่าย ดูความคืบหน้าเป็น %",
        icon: Target,
      },
    ],
  },
  {
    title: "จัดการร้าน",
    links: [
      {
        href: "/categories",
        label: "จัดการหมวด",
        desc: "เพิ่ม / แก้ไข / ลบ หมวดรายรับ-รายจ่ายให้ตรงร้านคุณ",
        icon: Tags,
      },
      {
        href: "/recurring",
        label: "ค่าใช้จ่ายประจำ",
        desc: "ตั้งครั้งเดียว เช่น ค่าเช่า ระบบลงให้ทุกเดือนอัตโนมัติ",
        icon: Repeat,
      },
      {
        href: "/products",
        label: "บริหารกำไรขั้นต้นของสินค้า",
        desc: "ตั้งต้นทุน-ราคาขาย ดูอัตรากำไรขั้นต้นของแต่ละสินค้า",
        icon: Package,
      },
    ],
  },
  {
    title: "สรุป & ย้อนหลัง",
    links: [
      {
        href: "/budgets?filter=1",
        label: "สรุปรายจ่าย & งบประมาณของแต่ละเดือน",
        desc: "ดูยอดใช้จ่ายและงบของแต่ละเดือนที่มีข้อมูล เลือกเดือนย้อนหลังได้",
        icon: PieChart,
      },
      {
        href: "/profit?filter=1",
        label: "สรุปกำไรสุทธิของแต่ละเดือน",
        desc: "ดูกำไรสุทธิ = รายรับ − รายจ่าย เลือกดูรายวัน / รายเดือนย้อนหลังได้",
        icon: BarChart3,
      },
    ],
  },
  {
    title: "ภาษี & ส่งออก",
    links: [
      {
        href: "/vat",
        label: "ภาษี (VAT)",
        desc: "สรุปภาษีขาย-ซื้อ และยอดสุทธิที่ต้องยื่นในแต่ละเดือน",
        icon: Receipt,
      },
      {
        href: "/export",
        label: "ส่งออกข้อมูล",
        desc: "ดาวน์โหลดรายรับ-รายจ่ายเป็นไฟล์ CSV ส่งให้นักบัญชี",
        icon: Download,
      },
    ],
  },
] as const;

/** หัวกลุ่มเล็ก ๆ คั่นแต่ละหมวดของเครื่องมือ */
function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  );
}

/** แถวลิงก์เดียว — ไอคอนวงกลม + ชื่อ + คำอธิบาย + เชฟรอน */
function HubRow({ link }: { link: HubLink }) {
  const Icon = link.icon;
  return (
    <Link
      href={link.href}
      className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <Card className="flex items-center gap-3.5 p-4 transition-colors hover:bg-accent/40 active:scale-[0.99]">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
          <Icon className="h-6 w-6" strokeWidth={2.2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground">{link.label}</p>
          <p className="truncate text-sm text-muted-foreground">{link.desc}</p>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
      </Card>
    </Link>
  );
}

export default async function MorePage() {
  const user = await requireUser();

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-lg font-bold text-foreground">เพิ่มเติม</h1>
        <p className="text-sm text-muted-foreground">
          เครื่องมือและการตั้งค่าทั้งหมดของร้านคุณ รวมไว้ที่นี่ที่เดียว
        </p>
      </header>

      {/* เมนูเด่น — โน้ต/บันทึกย่อ อยู่บนสุด */}
      <HubRow link={NOTES_LINK} />

      {GROUPS.map((group) => (
        <section key={group.title} className="space-y-2.5">
          <GroupLabel>{group.title}</GroupLabel>
          {group.links.map((link) => (
            <HubRow key={link.href} link={link} />
          ))}
        </section>
      ))}

      {/* การแสดงผล — ปุ่มสลับสว่าง/มืด ในตัวหน้านี้ (เผื่อเข้าจากมือถือ) */}
      <section className="space-y-2.5">
        <GroupLabel>การแสดงผล</GroupLabel>
        <Card className="flex items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="font-semibold text-foreground">โหมดสว่าง / มืด</p>
            <p className="text-sm text-muted-foreground">
              ปรับให้สบายตา ระบบจำค่าไว้ให้อัตโนมัติ
            </p>
          </div>
          <ThemeToggle />
        </Card>
      </section>

      {/* บัญชี — อีเมล + ปุ่มออกจากระบบ (ย้าย logout มาที่นี่หลังเลิก popup "เพิ่มเติม") */}
      <section className="space-y-2.5">
        <GroupLabel>บัญชี</GroupLabel>
        <Card className="space-y-3 p-4">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">เข้าสู่ระบบเป็น</p>
            <p className="truncate font-medium text-foreground">{user.email}</p>
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-expense/30 bg-expense-soft px-4 py-2.5 text-sm font-semibold text-expense transition-colors hover:bg-expense/10 active:scale-[0.99]"
            >
              <LogOut className="h-4 w-4" />
              ออกจากระบบ
            </button>
          </form>
        </Card>
      </section>

      <p className="px-1 pt-1 text-center text-xs text-muted-foreground">
        PocketProfit · จดรายรับ-รายจ่ายและกำไรร้านค้าให้เป็นเรื่องง่าย 🌤️
      </p>
    </div>
  );
}
