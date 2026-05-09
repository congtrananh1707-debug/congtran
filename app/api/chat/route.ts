import { NextResponse } from "next/server";

// ============================================================
// CONFIG
// ============================================================

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
// llama-3-8b-8192 đã ngừng phục vụ; dùng model production hiện hành.
// Cho phép override qua env GROQ_MODEL.
const MODEL = process.env.GROQ_MODEL || "llama-3.1-8b-instant";

const ALL_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
type Level = (typeof ALL_LEVELS)[number];

type Profile = {
  name?: string;
  level?: Level;
  interests?: string[];
};

type ChatMessage = { role: "user" | "assistant"; content: string };

// ============================================================
// SYSTEM PROMPT — Elara: Adaptive AI English Tutor
// Phải chứa từ "JSON" để bật JSON mode của Groq.
// ============================================================

const SYSTEM_PROMPT = [
  "You are Elara — a world-class adaptive English tutor and warm conversationalist.",
  "",
  "ROLE",
  "- Lead a friendly, flowing conversation in English. Never let it stall.",
  "- Continuously assess the user's English level on the CEFR scale (A1, A2, B1, B2, C1, C2) by examining their sentence length, vocabulary range, and grammar in their last messages.",
  "- Reply at exactly ONE level above the user's current level (i+1 scaffolding). Example: user is A1 → reply at A2; user is C1 → reply at C2.",
  "- Track interests they mention (food, sports, music, travel, etc.) so future turns feel personal.",
  "",
  "SCAFFOLDING — gentle, never lecture",
  "- If the user used a wrong word, awkward phrasing, or the input is empty/quiet, populate the \"suggestion\" field with a soft hint like \"Did you mean: <better phrase>?\". Do NOT correct them inside the reply itself.",
  "- Always end the reply with exactly ONE open-ended follow-up question, simplified to fit the user's current level. No yes/no questions. Anchor the question in a concrete detail they shared.",
  "",
  "BILINGUAL HELP",
  "- If userLevel is A1 or A2, fill \"vietnamese\" with a faithful Vietnamese translation of the reply for support.",
  "- If userLevel is B1 or above, set \"vietnamese\" to the same translation anyway (the client may show it on demand).",
  "",
  "OUTPUT FORMAT — return STRICT JSON only. No prose, no markdown fences, no commentary outside the JSON.",
  "{",
  "  \"reply\": \"<your spoken English reply, 1-2 short sentences plus the follow-up question>\",",
  "  \"userLevel\": \"A1|A2|B1|B2|C1|C2\",",
  "  \"vietnamese\": \"<Vietnamese translation of reply>\",",
  "  \"suggestion\": \"<'Did you mean ...?' soft hint, or empty string>\",",
  "  \"vocabulary\": [",
  "    { \"term\": \"<an interesting English word/phrase from your reply worth memorizing>\", \"vi\": \"<short Vietnamese gloss>\" }",
  "  ],",
  "  \"interests\": [\"<any new interest topic detected this turn>\"]",
  "}",
  "",
  "The vocabulary array must contain 0–3 items. Pick mid-difficulty terms slightly above the user's current level (i+1). If nothing notable, return an empty array.",
  "",
  "STYLE",
  "- Speak natural, casual, warm English — like a close friend, not a teacher.",
  "- Reply must be short (1–2 sentences + 1 question), since the user hears it spoken aloud.",
  "- Never start with filler like 'As an AI…'. Just talk like a person.",
].join("\n");

// ============================================================
// HELPERS
// ============================================================

function buildProfileContext(profile: Profile | undefined): string {
  const name = profile?.name?.trim() || "(unknown)";
  const level = profile?.level || "(not yet assessed)";
  const interests = profile?.interests?.length
    ? profile.interests.join(", ")
    : "(none yet)";
  return [
    "CURRENT USER PROFILE — use it to calibrate i+1 scaffolding and to personalize the follow-up question:",
    `- Name: ${name}`,
    `- Last estimated level: ${level}`,
    `- Known interests: ${interests}`,
  ].join("\n");
}

function clampString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

// ============================================================
// ROUTE
// ============================================================

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      messages?: ChatMessage[];
      profile?: Profile;
    };

    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return NextResponse.json(
        { error: "Thiếu trường 'messages'." },
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
        temperature: 0.65,
        max_tokens: 450,
        // Bật JSON mode để response chắc chắn parse được
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "system", content: buildProfileContext(body.profile) },
          ...body.messages,
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

    // Parse JSON; nếu thất bại dùng raw làm reply để vẫn nói được.
    let parsed: any = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { reply: raw };
    }

    const fallbackLevel: Level =
      (body.profile?.level as Level) || "A2";
    const userLevel: Level = (ALL_LEVELS as readonly string[]).includes(
      parsed?.userLevel
    )
      ? (parsed.userLevel as Level)
      : fallbackLevel;

    const reply = clampString(parsed?.reply);
    const vietnamese = clampString(parsed?.vietnamese);
    const suggestion = clampString(parsed?.suggestion);

    const vocabulary = Array.isArray(parsed?.vocabulary)
      ? parsed.vocabulary
          .slice(0, 3)
          .map((v: any) => ({
            term: clampString(v?.term),
            vi: clampString(v?.vi),
          }))
          .filter((v: { term: string }) => v.term.length > 0)
      : [];

    const interests = Array.isArray(parsed?.interests)
      ? parsed.interests
          .slice(0, 3)
          .map((s: unknown) => clampString(s))
          .filter((s: string) => s.length > 0)
      : [];

    return NextResponse.json({
      reply,
      userLevel,
      vietnamese,
      suggestion,
      vocabulary,
      interests,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Lỗi không xác định.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
