"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Loader2 } from "lucide-react";

import { signup, type AuthState } from "@/app/(auth)/actions";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AuthState = {};

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(signup, initialState);

  return (
    <AuthShell title="สมัครสมาชิก" subtitle="สร้างบัญชีใหม่เพื่อเริ่มใช้งาน">
      <form action={formAction} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">ชื่อ</Label>
          <Input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            placeholder="ชื่อของคุณ"
            className="h-12"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">อีเมล</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            className="h-12"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">รหัสผ่าน</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="อย่างน้อย 8 ตัวอักษร"
            className="h-12"
            required
          />
        </div>
        {state.error ? (
          <p role="alert" className="text-sm font-medium text-destructive">
            {state.error}
          </p>
        ) : null}
        <Button type="submit" className="h-12 w-full text-base" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" /> กำลังสมัครสมาชิก…
            </>
          ) : (
            "สมัครสมาชิก"
          )}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          มีบัญชีอยู่แล้ว?{" "}
          <Link href="/login" className="font-semibold text-brand underline-offset-4 hover:underline">
            เข้าสู่ระบบ
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
