"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Download, CalendarRange } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { dateKeyString } from "@/lib/validation";
import { todayDateKey } from "@/lib/dates";

/**
 * Schema ช่วงส่งออก — ใช้ dateKeyString เดิม (รูปแบบถูก + ไม่ใช่อนาคต, ข้อความไทย)
 * แล้ว refine ข้ามฟิลด์ว่า "ตั้งแต่" ต้องไม่เกิน "ถึง". client validate ก่อนดาวน์โหลด;
 * ฝั่ง server (route /entries/export) ตรวจซ้ำ + ผูก userId เองอยู่แล้ว.
 */
const exportRangeSchema = z
  .object({ from: dateKeyString, to: dateKeyString })
  .refine((v) => v.from <= v.to, {
    path: ["to"],
    message: "วันสิ้นสุดต้องไม่ก่อนวันเริ่ม",
  });

type ExportRangeValues = z.infer<typeof exportRangeSchema>;

/** การ์ด "ส่งออกตามช่วงวันที่" — เลือกวันเริ่ม–สิ้นสุดเอง ไม่จำกัดแค่ทั้งเดือน. */
export function ExportRangeCard({
  defaultFrom,
  defaultTo,
}: {
  defaultFrom: string;
  defaultTo: string;
}) {
  const today = todayDateKey();
  const form = useForm<ExportRangeValues>({
    resolver: zodResolver(exportRangeSchema),
    defaultValues: { from: defaultFrom, to: defaultTo },
    mode: "onChange",
  });

  // ผ่าน validation แล้วค่อยยิงดาวน์โหลด: คลิก <a download> ที่ชี้ไป route โดยตรง
  function onSubmit(values: ExportRangeValues) {
    const href = `/entries/export?from=${values.from}&to=${values.to}`;
    const a = document.createElement("a");
    a.href = href;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <Card className="rounded-2xl p-5">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
          <CalendarRange className="h-6 w-6" strokeWidth={2.2} />
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-foreground">ส่งออกตามช่วงวันที่</p>
          <p className="text-sm text-muted-foreground">
            เลือกวันเริ่ม–สิ้นสุดเอง เช่น ทั้งไตรมาส หรือเฉพาะสัปดาห์นี้
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="from"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ตั้งแต่วันที่</FormLabel>
                  <FormControl>
                    <Input {...field} type="date" max={today} className="h-12 text-base" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="to"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ถึงวันที่</FormLabel>
                  <FormControl>
                    <Input {...field} type="date" max={today} className="h-12 text-base" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <Button
            type="submit"
            className="h-14 w-full bg-brand text-lg text-brand-foreground hover:bg-brand/90"
          >
            <Download className="h-5 w-5" strokeWidth={2.4} />
            ดาวน์โหลด CSV ช่วงนี้
          </Button>
        </form>
      </Form>
    </Card>
  );
}
