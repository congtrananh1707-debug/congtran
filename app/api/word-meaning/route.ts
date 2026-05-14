import { NextResponse } from "next/server";

// ============================================================
// /api/word-meaning — tra cứu nghĩa 1 từ trong NGỮ CẢNH câu Kong đã nói.
//
// Beginner click 1 từ trong message của Kong → tooltip hiện:
//   - nghĩa tiếng Việt (gọn 1 dòng)
//   - phiên âm IPA
//   - nút loa để nghe lại
//
// Endpoint riêng vì:
//   - Cần latency thấp (user click → tooltip phải hiện nhanh)
//   - Prompt cực gọn — 1 từ, 3 trường output
//   - Có thể cache phía client theo (word, context) để khỏi gọi lại
// ============================================================

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = process.env.GROQ_MODEL || "llama-3.1-8b-instant";

const SYSTEM_PROMPT = [
  "You are a precise English-to-Vietnamese dictionary. Return STRICT JSON only.",
  "",
  "The user gives you ONE English word and the SENTENCE it appeared in. Use the sentence as context to disambiguate meaning.",
  "",
  "Output the meaning IN THE CONTEXT GIVEN — not all possible meanings.",
  "",
  "OUTPUT FORMAT — JSON, no prose, no markdown:",
  "{",
  "  \"vi\": \"<short Vietnamese gloss in context, ≤ 12 words, lowercase preferred>\",",
  "  \"ipa\": \"<IPA phonetic transcription with /slashes/, British or General American>\",",
  "  \"pos\": \"<part of speech: noun|verb|adj|adv|prep|conj|pron|det|other>\"",
  "}",
  "",
  "If the word is not a real English word or you cannot determine meaning, return empty strings for all fields.",
].join("\n");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clamp(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { word?: string; context?: string };
    const word = (body.word ?? "").trim();
    const context = (body.context ?? "").trim();
    if (!word || word.length > 40) {
      return NextResponse.json({ vi: "", ipa: "", pos: "" });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Server chưa cấu hình GROQ_API_KEY." },
        { status: 500 }
      );
    }

    const userMsg = context
      ? `Word: "${word}"\nSentence: "${context}"`
      : `Word: "${word}"`;

    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.1,
        max_tokens: 120,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMsg },
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

    return NextResponse.json({
      vi: clamp(parsed?.vi),
      ipa: clamp(parsed?.ipa),
      pos: clamp(parsed?.pos),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Lỗi không xác định.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
