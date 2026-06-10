import "server-only";

/**
 * โหมด A (smart) — Claude Haiku 4.5 + tool-use. ใช้เฉพาะเมื่อมี ANTHROPIC_API_KEY.
 *
 * ความปลอดภัย/ความถูกต้อง:
 *  - key อ่านจาก process.env ใน server module นี้เท่านั้น — ไม่มีทางหลุดไป client (AI-7).
 *  - import SDK แบบ lazy ภายในฟังก์ชัน → ถ้าไม่มี key ก็ไม่โหลด SDK เลย (แอปรันได้แม้ไม่ลง sdk).
 *  - ทุก tool ที่ execute ผูก userId ของผู้ใช้คนนี้ (จาก action) — โมเดลสั่ง tool ได้เฉพาะ read-only.
 *  - error ใด ๆ → throw ออกไปให้ action catch แล้ว fallback ไปโหมด B (ไม่มี raw 500 ถึง client).
 *
 * คืน null ทันทีถ้าไม่มี key (ให้ action ไปใช้โหมด B).
 */

import type {
  MessageParam,
  Tool,
  TextBlock,
  ToolResultBlockParam,
} from "@anthropic-ai/sdk/resources/messages";

import { assistantTools, findTool } from "@/lib/assistant/tools";
import { SYSTEM_PROMPT } from "@/lib/assistant/scope";
import type { AssistantAnswer } from "@/lib/assistant/deterministic";

/** input_schema ของ Anthropic tool (indexed type — เลี่ยงพึ่ง namespace Tool.InputSchema). */
type ToolInputSchema = Tool["input_schema"];

const MODEL = "claude-haiku-4-5";
const MAX_TOOL_ITERATIONS = 4;
const MAX_TOKENS = 1024;

/** ประวัติแชต (จาก client) — เก็บแค่ role + ข้อความ, ไม่เก็บ tool block. */
export type ChatTurn = { role: "user" | "assistant"; content: string };

/**
 * JSON schema ขั้นต่ำของแต่ละ tool สำหรับ Anthropic tool-use.
 * tool ส่วนใหญ่ไม่รับ args; บางตัวรับ monthKey (YYYY-MM) แบบ optional.
 * เขียนมือ (แทนการแปลง zod) เพื่อคุม schema ให้เล็ก/ชัด และไม่พึ่ง dependency เสริม.
 */
function toolInputSchema(name: string): Record<string, unknown> {
  // tool ที่รับ monthKey ได้
  // หมายเหตุ: getProfitSummary ไม่อยู่ในนี้ — มันอิง "วันนี้/เดือนนี้ vs เดือนก่อน" เสมอ
  // จึงไม่โฆษณา monthKey เพื่อกันคำตอบเดือนปัจจุบันติดป้ายเป็นเดือนย้อนหลัง.
  const acceptsMonth = new Set([
    "getBudgetStatus",
    "getGoalProgress",
    "getRecurringStatus",
    "getVatSummary",
  ]);
  if (acceptsMonth.has(name)) {
    return {
      type: "object",
      properties: {
        monthKey: {
          type: "string",
          description: "เดือนที่ต้องการในรูปแบบ YYYY-MM (ไม่ใส่ = เดือนปัจจุบัน)",
          pattern: "^\\d{4}-\\d{2}$",
        },
      },
      additionalProperties: false,
    };
  }
  return { type: "object", properties: {}, additionalProperties: false };
}

/**
 * ถาม Claude พร้อม tool-use loop. คืน null ถ้าไม่มี key.
 * โยน error เมื่อ SDK/เครือข่ายล้ม → action จะ fallback ไปโหมด B.
 */
export async function answerWithClaude(
  userId: string,
  question: string,
  history: ChatTurn[] = [],
): Promise<AssistantAnswer | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null; // ไม่มี key → โหมด A ปิด

  // lazy import: โหลด SDK ต่อเมื่อจะใช้จริงเท่านั้น
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey });

  // ประกาศ tools ให้โมเดล (read-only ทั้งหมด)
  const tools: Tool[] = assistantTools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: toolInputSchema(t.name) as ToolInputSchema,
  }));

  // สร้าง messages: history (ตัดท้ายไม่กี่เทิร์น) + คำถามปัจจุบัน
  const trimmedHistory = history.slice(-6).map((h) => ({
    role: h.role,
    content: h.content,
  }));
  const messages: MessageParam[] = [
    ...trimmedHistory,
    { role: "user", content: question },
  ];

  const sources = new Set<string>();
  // map tool → หน้าในแอป (ให้ลิงก์ลึกแม้โหมด A)
  const TOOL_HREF: Record<string, string> = {
    getProfitSummary: "/profit",
    getBudgetStatus: "/budgets",
    getGoalProgress: "/goals",
    getLowMarginProducts: "/products",
    getRecurringStatus: "/recurring",
    getVatSummary: "/vat",
    getSpendingTrend: "/profit",
  };

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      tools,
      messages,
    });

    if (res.stop_reason === "tool_use") {
      // เก็บ assistant turn (มี tool_use block) แล้ว execute tool ทุกตัวที่ขอ
      messages.push({ role: "assistant", content: res.content });

      const toolResults: ToolResultBlockParam[] = [];
      for (const block of res.content) {
        if (block.type !== "tool_use") continue;
        const def = findTool(block.name);
        if (def) sources.add(TOOL_HREF[block.name] ?? "/");
        let resultJson: unknown;
        try {
          if (!def) {
            resultJson = { error: "ไม่รู้จักเครื่องมือนี้" };
          } else {
            // re-validate args ด้วย zod ของ tool เอง (กัน arg แปลก ๆ)
            const args = (block.input ?? {}) as Record<string, unknown>;
            const parsed = def.inputSchema.safeParse(args);
            const safeArgs = parsed.success ? (parsed.data as Record<string, unknown>) : {};
            resultJson = await def.run(userId, safeArgs); // read-only, ผูก userId
          }
        } catch {
          resultJson = { error: "ดึงข้อมูลไม่สำเร็จ" };
        }
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(resultJson),
        });
      }
      messages.push({ role: "user", content: toolResults });
      continue; // วนต่อให้โมเดลสรุปคำตอบ
    }

    // ไม่มี tool_use แล้ว → ประกอบข้อความตอบจาก text block
    const text = res.content
      .filter((b): b is TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    if (!text) throw new Error("empty completion"); // ให้ fallback ไปโหมด B
    return { answer: text, sources: sources.size > 0 ? [...sources] : undefined };
  }

  // วนครบเพดานแล้วยังไม่ได้คำตอบสุดท้าย → fallback
  throw new Error("tool loop exceeded");
}
