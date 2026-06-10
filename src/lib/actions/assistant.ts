"use server";

/**
 * Server action ของผู้ช่วย PocketProfit (AI-1..AI-7).
 * - requireUser() เสมอ → ทุก tool ผูก user.id (per-user, ไม่มี cross-user leak).
 * - re-validate input ด้วย zod (ไม่เชื่อ client): ว่าง/ยาวเกิน → ข้อความไทยเจาะจง (ไม่ throw).
 * - HYBRID: มี key → ลองโหมด A (Claude) ก่อน, ล้มเหลว/ไม่มี key → โหมด B (deterministic) เสมอ.
 * - outer try/catch → ERROR_FALLBACK; ไม่ปล่อย raw 500 / ไม่หลุด key / ไม่หลุด stack ถึง client.
 */

import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { answerWithClaude, type ChatTurn } from "@/lib/assistant/claude";
import { answerDeterministic } from "@/lib/assistant/deterministic";
import { EMPTY_INPUT, TOO_LONG, ERROR_FALLBACK } from "@/lib/assistant/scope";

export type AssistantReply = {
  answer: string;
  mode: "claude" | "local";
  sources?: string[];
};

/** ประวัติแชตที่ client ส่งมา (ตัด/normalize ก่อนใช้). */
export type AssistantHistory = ChatTurn[];

const MAX_LEN = 500;

/** schema คำถาม: trim, ต้องมีอย่างน้อย 1 ตัว, ไม่เกิน 500. แยกข้อความ error ไว้ map เป็นไทย. */
const questionSchema = z
  .string({ invalid_type_error: "empty" })
  .trim()
  .min(1, "empty")
  .max(MAX_LEN, "too_long");

/** normalize history จาก client (กัน payload แปลก) → ChatTurn ที่ปลอดภัย. */
function normalizeHistory(history: unknown): ChatTurn[] {
  if (!Array.isArray(history)) return [];
  const out: ChatTurn[] = [];
  for (const h of history) {
    if (!h || typeof h !== "object") continue;
    const role = (h as { role?: unknown }).role;
    const content = (h as { content?: unknown }).content;
    if ((role === "user" || role === "assistant") && typeof content === "string") {
      const text = content.trim().slice(0, MAX_LEN);
      if (text) out.push({ role, content: text });
    }
  }
  return out.slice(-8); // เก็บแค่ไม่กี่เทิร์นล่าสุด
}

/**
 * ถามผู้ช่วย. คืนข้อความไทยเสมอ + โหมดที่ใช้ (claude/local) + ลิงก์ลึก (ถ้ามี).
 * ไม่เคย throw ออกไป client.
 */
export async function askAssistant(
  input: string,
  history?: AssistantHistory,
): Promise<AssistantReply> {
  try {
    const user = await requireUser();

    // 1) validate input (ไม่เชื่อ client)
    const parsed = questionSchema.safeParse(input);
    if (!parsed.success) {
      const code = parsed.error.issues[0]?.message;
      const msg = code === "too_long" ? TOO_LONG : EMPTY_INPUT;
      return { answer: msg, mode: "local" }; // บล็อก แต่ไม่ throw (AI-6)
    }
    const question = parsed.data;
    const turns = normalizeHistory(history);

    // 2) โหมด A ก่อน ถ้ามี key — ล้มเหลวเงียบ ๆ แล้วตกไปโหมด B
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const r = await answerWithClaude(user.id, question, turns);
        if (r && r.answer.trim()) {
          return { answer: r.answer, mode: "claude", sources: r.sources };
        }
      } catch {
        // โหมด A ล่ม (เน็ต/SDK/timeout) → degrade ไปโหมด B (AI-6)
      }
    }

    // 3) โหมด B (deterministic) — ตาข่ายนิรภัยที่ทำงานเสมอ
    const r = await answerDeterministic(user.id, question);
    return { answer: r.answer, mode: "local", sources: r.sources };
  } catch {
    // 4) กันสุดท้าย: อะไรพังก็ตาม (รวมโหมด B) → ข้อความไทยสุภาพ ไม่หลุด key/stack
    return { answer: ERROR_FALLBACK, mode: "local" };
  }
}
