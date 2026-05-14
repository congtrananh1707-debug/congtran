import { NextResponse } from "next/server";

// ============================================================
// /api/correct — endpoint riêng chỉ làm sửa lỗi ngữ pháp tiếng Anh.
//
// Trước đây correction được nhồi vào /api/chat cùng với reply, betterWay,
// suggestions, vocab... Llama 8B kích thước nhỏ thường bỏ qua field
// correction vì nó nằm cuối một schema 8 trường. Tách thành 1 call riêng
// với prompt cực gọn, schema 3 trường → kết quả tin cậy hơn nhiều.
// ============================================================

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = process.env.GROQ_MODEL || "llama-3.1-8b-instant";

const SYSTEM_PROMPT = [
  "You are a strict English grammar checker. Return STRICT JSON only.",
  "",
  "Read the single English sentence the user just said. Look ONLY at THAT sentence.",
  "",
  "Find at most ONE clear error of any of these types:",
  "- verb tense (e.g. \"I go yesterday\" → \"I went yesterday\")",
  "- subject–verb agreement (e.g. \"he don't\" → \"he doesn't\")",
  "- article a/an/the (missing or wrong)",
  "- preposition (e.g. \"heard about\" vs \"heard of\")",
  "- singular/plural (e.g. \"these place\" → \"this place\" or \"these places\")",
  "- possessive ('s vs s')",
  "- word order / wrong infinitive (e.g. \"want to going\" → \"want to go\")",
  "- clearly wrong word choice that changes meaning.",
  "",
  "RULES",
  "- If you find an error, fix it. Keep the original meaning. Output exactly the same sentence with only the minimum change.",
  "- If the sentence is a single word, a tiny fragment, or already correct, return empty strings for all three fields. Do NOT invent errors.",
  "- Stylistic 'better way' upgrades are NOT errors. Skip them.",
  "- The explanation must be in Vietnamese, ≤ 20 words, plain prose.",
  "",
  "OUTPUT FORMAT — JSON only, no prose, no markdown:",
  "{",
  "  \"original\": \"<verbatim user sentence, or empty if no error>\",",
  "  \"corrected\": \"<same sentence with the error fixed, or empty>\",",
  "  \"explanation\": \"<short Vietnamese note, or empty>\"",
  "}",
].join("\n");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clamp(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { text?: string };
    const text = (body.text ?? "").trim();
    if (!text || text === "[start]" || text.length < 3) {
      return NextResponse.json({ original: "", corrected: "", explanation: "" });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Server chưa cấu hình GROQ_API_KEY." },
        { status: 500 }
      );
    }

    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        // Nhiệt độ thấp — correction phải xác định, không sáng tạo.
        temperature: 0.1,
        max_tokens: 200,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: text },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json(
        { error: `Lỗi từ Groq (${res.status}): ${errText}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    const raw: string = data?.choices?.[0]?.message?.content ?? "{}";
    let parsed: any = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {};
    }

    const original = clamp(parsed?.original);
    const corrected = clamp(parsed?.corrected);
    const explanation = clamp(parsed?.explanation);

    // Chỉ trả về correction "có giá trị" — original và corrected phải khác nhau.
    if (!original || !corrected || original === corrected) {
      return NextResponse.json({ original: "", corrected: "", explanation: "" });
    }

    return NextResponse.json({ original, corrected, explanation });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Lỗi không xác định.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
