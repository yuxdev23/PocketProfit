"use client";

/**
 * แผงแชต "ผู้ช่วย PocketProfit" (AI-1..AI-6 ฝั่ง UI).
 * - Dialog (ui/dialog) สไตล์มือถือ: bubble ผู้ใช้ vs ผู้ช่วย, ช่องพิมพ์ + ปุ่มส่ง (Enter ส่งได้).
 * - states: empty (ทักทาย + คำถามแนะนำ chips), loading (typing indicator), error (bubble ERROR_FALLBACK).
 * - เรียก server action askAssistant; ปุ่มส่ง disabled ระหว่างโหลด (กันกดซ้ำ).
 * - badge เล็ก ๆ บอกโหมด ("AI" = Claude / "ออฟไลน์" = deterministic) ต่อคำตอบของผู้ช่วย.
 * - accessible: aria-label, โฟกัส input ตอนเปิด, Esc ปิด (Dialog จัดการ).
 */

import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, Loader2, MessageCircle } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { askAssistant, type AssistantReply } from "@/lib/actions/assistant";
import { ERROR_FALLBACK } from "@/lib/assistant/messages";

type Role = "user" | "assistant";
type Message = {
  id: string;
  role: Role;
  content: string;
  mode?: "claude" | "local";
  sources?: string[];
};

/** คำถามแนะนำ (chips) — แตะเพื่อส่งทันที. */
const SUGGESTIONS = [
  "กำไรเดือนนี้เท่าไหร่?",
  "หมวดไหนใช้เกินงบ?",
  "สินค้าไหนกำไรน้อย?",
  "ตั้งงบยังไง?",
];

/** ป้ายชื่อหน้า (deep link) → ข้อความไทยสั้น ๆ. */
const HREF_LABEL: Record<string, string> = {
  "/": "หน้าหลัก",
  "/entries": "รายการ",
  "/budgets": "งบประมาณ",
  "/profit": "กำไร",
  "/goals": "เป้าหมาย",
  "/products": "สินค้า",
  "/recurring": "ค่าใช้จ่ายประจำ",
  "/export": "ส่งออกข้อมูล",
  "/vat": "ภาษี (VAT)",
};

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `m${idCounter}`;
}

export function AssistantSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // เลื่อนลงล่างสุดเมื่อมีข้อความ/สถานะใหม่
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // โฟกัสช่องพิมพ์เมื่อเปิดแผง
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || loading) return;

    const userMsg: Message = { id: nextId(), role: "user", content: q };
    // ประวัติสำหรับ context ฝั่งโหมด A (ก่อนเพิ่มข้อความปัจจุบัน)
    const history = messages.map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, userMsg]);
    setDraft("");
    setLoading(true);

    try {
      const reply: AssistantReply = await askAssistant(q, history);
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: "assistant",
          content: reply.answer,
          mode: reply.mode,
          sources: reply.sources,
        },
      ]);
    } catch {
      // action call เองล่ม (เน็ต) → bubble ข้อความไทย ไม่ใช่ raw error
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: "assistant", content: ERROR_FALLBACK, mode: "local" },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    void send(draft);
  }

  const isEmpty = messages.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[88vh] max-h-[88vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
        aria-label="ผู้ช่วย PocketProfit"
      >
        <DialogHeader className="shrink-0 space-y-0 border-b border-border p-4 text-left">
          <DialogTitle className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand/15 text-brand">
              <Sparkles className="h-4 w-4" />
            </span>
            ผู้ช่วย PocketProfit
          </DialogTitle>
          <DialogDescription className="pl-10">
            ถามเรื่องกำไร งบ เป้าหมาย สินค้า หรือวิธีใช้งานได้เลยครับ
          </DialogDescription>
        </DialogHeader>

        {/* รายการข้อความ */}
        <div
          ref={listRef}
          className="flex-1 space-y-3 overflow-y-auto p-4"
          aria-live="polite"
          role="log"
        >
          {isEmpty ? (
            <EmptyState onPick={(q) => void send(q)} disabled={loading} />
          ) : (
            messages.map((m) => <Bubble key={m.id} message={m} />)
          )}

          {loading && <TypingBubble />}
        </div>

        {/* ช่องพิมพ์ */}
        <form
          onSubmit={onSubmit}
          className="flex shrink-0 items-center gap-2 border-t border-border bg-background p-3"
        >
          <Input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="พิมพ์คำถาม…"
            aria-label="พิมพ์คำถามถึงผู้ช่วย"
            disabled={loading}
            className="h-11 flex-1"
            autoComplete="off"
            enterKeyHint="send"
          />
          <Button
            type="submit"
            size="icon"
            aria-label="ส่งคำถาม"
            disabled={loading || draft.trim().length === 0}
            className="h-11 w-11 shrink-0 bg-brand text-brand-foreground hover:bg-brand/90"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** สถานะว่าง: ทักทาย + chips คำถามแนะนำ. */
function EmptyState({ onPick, disabled }: { onPick: (q: string) => void; disabled: boolean }) {
  return (
    <div className="flex flex-col items-center gap-4 py-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand/15 text-brand">
        <MessageCircle className="h-7 w-7" />
      </span>
      <div className="space-y-1">
        <p className="font-semibold text-foreground">สวัสดีครับ ผมเป็นผู้ช่วย PocketProfit</p>
        <p className="text-sm text-muted-foreground">
          ลองเลือกคำถามด้านล่าง หรือพิมพ์คำถามของพี่ได้เลยครับ
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onPick(q)}
            disabled={disabled}
            className="rounded-full border border-brand/30 bg-brand/5 px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-brand/10 disabled:opacity-50"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

/** bubble ข้อความ — ผู้ใช้ (ขวา, สีแบรนด์) vs ผู้ช่วย (ซ้าย, การ์ด) + ลิงก์ลึก + badge โหมด. */
function Bubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
          isUser
            ? "rounded-br-sm bg-brand text-brand-foreground"
            : "rounded-bl-sm border border-border bg-card text-card-foreground",
        )}
      >
        <p className="whitespace-pre-wrap break-words">{message.content}</p>

        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {message.sources.map((href) => (
              <a
                key={href}
                href={href}
                className="inline-flex items-center rounded-full bg-brand/10 px-2.5 py-1 text-xs font-medium text-brand transition-colors hover:bg-brand/20"
              >
                ไปที่ {HREF_LABEL[href] ?? href} →
              </a>
            ))}
          </div>
        )}

        {!isUser && message.mode && (
          <div className="mt-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {message.mode === "claude" ? "AI" : "ออฟไลน์"}
          </div>
        )}
      </div>
    </div>
  );
}

/** typing indicator (สามจุดเด้ง) ระหว่างรอคำตอบ. */
function TypingBubble() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm border border-border bg-card px-4 py-3">
        <span className="sr-only">ผู้ช่วยกำลังพิมพ์</span>
        <Dot delay="0ms" />
        <Dot delay="150ms" />
        <Dot delay="300ms" />
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60"
      style={{ animationDelay: delay }}
    />
  );
}
