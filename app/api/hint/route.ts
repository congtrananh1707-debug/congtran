import { NextResponse } from "next/server";

// ============================================================
// SMART HINT — gợi ý real-time khi user đang kẹt giữa câu
// (im lặng > vài giây hoặc lẫn từ tiếng Việt). Trả 1 dòng
// ngắn gọn dạng "Did you mean [Word]?".
// ============================================================

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = process.env.GROQ_MODEL || "llama-3.1-8b-instant";

const HINT_PROMPT = [
  "You are Kong, a patient English tutor. The user is mid-sentence and got stuck — they paused or threw in a Vietnamese word.",
  "Read the partial input and guess the SINGLE most likely English word or short phrase they were reaching for.",
  "Reply with STRICT JSON only:",
  "{ \"hint\": \"Did you mean [Word]?\" }",
  "Rules:",
  "- The hint must be a single short line, under 12 words, in English.",
  "- If they said a Vietnamese word, suggest the natural English equivalent.",
  "- If you cannot guess confidently, return { \"hint\": \"\" }.",
].join("\n");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { text?: string };
    const text = (body.text ?? "").trim();
    if (!text) return NextResponse.json({ hint: "" });

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Server chưa cấu hình GROQ_API_KEY." },
        { status: 500 }
      );
    }

    const groqRes = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.3,
        max_tokens: 60,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: HINT_PROMPT },
          { role: "user", content: text },
        ],
      }),
    });

    if (!groqRes.ok) {
      // Hint là "nice to have" — fail êm thay vì spam lỗi UI.
      return NextResponse.json({ hint: "" });
    }

    const data = await groqRes.json();
    const raw: string = data?.choices?.[0]?.message?.content ?? "{}";
    let parsed: any = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {};
    }
    const hint = typeof parsed?.hint === "string" ? parsed.hint.trim() : "";
    return NextResponse.json({ hint });
  } catch {
    return NextResponse.json({ hint: "" });
  }
}
