import { NextResponse } from "next/server";

// ============================================================
// BRAINSTORM — Think Out Loud. User nói đại ý (Việt / Anh bồi),
// Kong trả lại 1 dàn ý ngắn dạng outline (text-only, không TTS).
// ============================================================

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = process.env.GROQ_MODEL || "llama-3.1-8b-instant";

const BRAINSTORM_PROMPT = [
  "You are Kong, an empathetic English tutor. The user wants to talk about a topic but needs a quick outline first.",
  "Their input may be Vietnamese, English, or 'broken English' — read it carefully and infer their intent.",
  "Return STRICT JSON only:",
  "{",
  "  \"topic\": \"<one short English line summarizing their topic>\",",
  "  \"vocabulary\": [ { \"term\": \"<English word/phrase, 3–5 items>\", \"vi\": \"<short Vietnamese gloss>\" } ],",
  "  \"starters\": [ \"<sentence starter 1>\", \"<starter 2>\", \"<starter 3>\" ]",
  "}",
  "Rules:",
  "- vocabulary: 3–5 mid-difficulty items genuinely useful for the topic.",
  "- starters: 2–3 ways to begin speaking about it (full English sentences, conversational tone).",
  "- Keep everything concise. This is a quick scaffold, not an essay.",
].join("\n");

type Vocab = { term: string; vi: string };

function clampString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { idea?: string };
    const idea = (body.idea ?? "").trim();
    if (!idea) {
      return NextResponse.json(
        { error: "Thiếu trường 'idea'." },
        { status: 400 }
      );
    }

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
        temperature: 0.6,
        max_tokens: 400,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: BRAINSTORM_PROMPT },
          { role: "user", content: idea },
        ],
      }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      return NextResponse.json(
        { error: `Lỗi từ Groq (${groqRes.status}): ${errText}` },
        { status: 502 }
      );
    }

    const data = await groqRes.json();
    const raw: string = data?.choices?.[0]?.message?.content ?? "{}";
    let parsed: any = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {};
    }

    const topic = clampString(parsed?.topic);
    const vocabulary: Vocab[] = Array.isArray(parsed?.vocabulary)
      ? parsed.vocabulary
          .slice(0, 5)
          .map((v: any) => ({
            term: clampString(v?.term),
            vi: clampString(v?.vi),
          }))
          .filter((v: Vocab) => v.term.length > 0)
      : [];
    const starters: string[] = Array.isArray(parsed?.starters)
      ? parsed.starters
          .slice(0, 3)
          .map((s: unknown) => clampString(s))
          .filter((s: string) => s.length > 0)
      : [];

    return NextResponse.json({ topic, vocabulary, starters });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Lỗi không xác định.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
