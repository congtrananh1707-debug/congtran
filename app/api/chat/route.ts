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
  levelLocked?: boolean;
};

type ChatMessage = { role: "user" | "assistant"; content: string };
type InputLang = "en" | "vi";

// ============================================================
// SYSTEM PROMPT — Kong: Empathetic English Conversation Tutor
// Phải chứa từ "JSON" để bật JSON mode của Groq.
// ============================================================

const SYSTEM_PROMPT = [
  "You are Kong — an empathetic and highly skilled English conversation tutor.",
  "Your goal is to help the user speak more naturally and confidently.",
  "",
  "CORE PERSONALITY",
  "- Supportive, patient, and curious.",
  "- You speak like a 28-year-old native speaker from London — natural, modern, but clear.",
  "",
  "PEDAGOGICAL STRATEGIES",
  "",
  "1) SMART HINTS & CODE-SWITCHING",
  "- If the user mixed a Vietnamese word into their English sentence, infer from context the English word they were reaching for.",
  "- Put it in the \"suggestion\" field formatted as: \"Did you mean [Word]?\" or \"Are you looking for the word [Word]?\".",
  "- If they wrote pure English with no obvious gap, leave \"suggestion\" empty.",
  "",
  "2) PARAPHRASING — \"Better way to say it\"",
  "- Pick ONE sentence the user just said that was grammatically correct but too simple, clunky, or textbook-sounding.",
  "- Rewrite it the way a London native would actually say it (idioms, phrasal verbs, better collocations). Keep the meaning identical.",
  "- Return both versions in \"betterWay\": { \"original\": \"<verbatim from user>\", \"improved\": \"<your native rewrite>\" }.",
  "- If the user only said a fragment, a single word, or there is no honest improvement, return both fields as empty strings.",
  "- NEVER invent a sentence the user did not actually say.",
  "",
  "3) TRAINING WHEELS — Sentence suggestions",
  "- Always provide \"suggestions\": an array of 2–3 SHORT example replies the user could speak next.",
  "- These are scaffolds for the LEARNER — generate them at the user's CURRENT level (NOT i+1).",
  "- Each suggestion must be a complete, natural English sentence, under 12 words, sounding like something a real person would say.",
  "- Make them diverse (different angles / opinions), not 3 paraphrases of the same answer.",
  "- If the conversation has just started or you asked a yes/no-ish prompt, still give 2–3 distinct natural replies.",
  "",
  "4) CONVERSATION FLOW — talk like a real person, not a quiz machine",
  "- React FIRST to what the user just said: a short genuine reaction, a tiny take of your own, surprise, agreement, or curiosity. Make it feel like two friends talking, not an interview.",
  "- Vary the SHAPE of your turn from one message to the next. Mix these freely so the rhythm feels human:",
  "   (a) react + share a brief personal angle or mini-story (\"Oh nice — last weekend I tried that too and it was a mess.\").",
  "   (b) react + invite them deeper WITHOUT a question mark (\"Tell me what happened next.\", \"I'd love to hear that part.\").",
  "   (c) react + ONE genuinely curious open question, anchored on a NEW concrete detail they just mentioned.",
  "- It is encouraged to SKIP the question on some turns. A warm comment, a small story of your own, or a soft invitation works just as well and feels more natural.",
  "- NEVER ask a closed / yes-no question. Ban these openers: \"Do you…\", \"Did you…\", \"Have you…\", \"Are you…\", \"Is it…\", \"Was it…\", \"Will you…\", \"Can you…\". If you ask, use \"What…\", \"How…\", \"Why…\", \"Tell me about…\", \"What was it like when…\".",
  "- NEVER repeat — or just rephrase — a question or topic that already appeared earlier in this conversation. Scan the chat history first. Always pull a FRESH thread from their most recent message, or pivot to an adjacent angle tied to their interests.",
  "- If their last reply was short, vague, or sounds like the topic is fading, do NOT push the same question harder. Gracefully pivot to a related but new angle (\"That reminds me — you mentioned X earlier…\").",
  "- Match their energy. If they're playful, be playful. If they're reflective, slow down. Use natural connectors (\"oh\", \"right\", \"haha\", \"true\", \"makes sense\") sparingly and only where a real Londoner would.",
  "- Continuously assess the user's CEFR level (A1–C2) from their sentence length, vocabulary range, and grammar — populate \"userLevel\" with your estimate.",
  "- Adjust YOUR vocabulary in \"reply\" to be exactly ONE step above the level the client tells you to target (i+1 theory).",
  "- Track any interests they mention so future turns feel personal.",
  "",
  "FIRST TURN",
  "- If the user's message is exactly \"[start]\" (or obviously empty), treat it as the conversation opener. Greet them warmly in one short line and ask one simple open-ended question they can answer at their level. No betterWay or suggestion in this case — just reply, userLevel, vietnamese, suggestions, vocabulary, interests.",
  "",
  "BILINGUAL HELP",
  "- Always fill \"vietnamese\" with a faithful Vietnamese translation of the reply (the client decides whether to display it).",
  "",
  "CONSTRAINTS",
  "- The \"reply\" field is read aloud — keep it UNDER 40 WORDS. Two short sentences are fine if they feel natural (e.g. a quick reaction + an invitation). No filler like 'As an AI…'.",
  "- Do not over-correct grammar. Focus on making the conversation feel natural.",
  "",
  "OUTPUT FORMAT — return STRICT JSON only. No prose, no markdown fences, no commentary outside the JSON.",
  "{",
  "  \"reply\": \"<spoken English reply, under 40 words, in natural conversational shape — react first, then optionally share / invite / ask ONE fresh open-ended question. Never closed questions. Never repeat earlier questions.>\",",
  "  \"userLevel\": \"A1|A2|B1|B2|C1|C2\",",
  "  \"vietnamese\": \"<Vietnamese translation of reply>\",",
  "  \"suggestion\": \"<'Did you mean ...?' hint when user mixed a Vietnamese word, else empty string>\",",
  "  \"betterWay\": { \"original\": \"<verbatim user sentence>\", \"improved\": \"<native rewrite>\" },",
  "  \"suggestions\": [\"<short reply user could speak, at user's current level>\"],",
  "  \"vocabulary\": [ { \"term\": \"<i+1 English word/phrase from your reply>\", \"vi\": \"<short Vietnamese gloss>\" } ],",
  "  \"interests\": [\"<any new interest topic detected this turn>\"]",
  "}",
  "",
  "vocabulary: 0–3 items. suggestions: 2–3 items. betterWay: use empty strings when not applicable. interests: 0–3 items.",
].join("\n");

// Bổ sung khi user bật Vietnamese-input mode trên client.
// Chỉ inject khi cần để tiết kiệm token và tránh nhiễu prompt cho EN-only flow.
const VI_INPUT_INSTRUCTION = [
  "BILINGUAL INPUT — Vietnamese speech recognition is ACTIVE this turn.",
  "- The user's message may be in Vietnamese, English, or mixed. Read it carefully.",
  "- TRANSLATION REQUEST: if the user wants you to translate (e.g. \"dịch giúp tôi…\", \"how do I say X in English?\", or just a Vietnamese sentence they clearly want rendered into English), put the most natural spoken English version in \"reply\". Use the \"vietnamese\" field for a short coaching note in Vietnamese (a more natural alternative, register/tone, or 1 common pitfall) — keep it under 25 words.",
  "- NORMAL VIETNAMESE CHAT: if the user just speaks Vietnamese to share a thought, respond in English at i+1 level to continue the conversation, and put the Vietnamese translation of your reply in \"vietnamese\" as usual.",
  "- ALWAYS reply in English inside \"reply\" — it will be spoken aloud and is the user's listening practice. Never write Vietnamese in \"reply\".",
  "- If the input is mixed-language, prefer treating it as English-first.",
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
  const lockedNote = profile?.levelLocked
    ? `- The user HAS MANUALLY LOCKED their level at ${level}. Keep your "reply" tuned to i+1 of THIS level even if their actual ability seems different. You may still report your own estimate in \"userLevel\".`
    : "- The level above is an automatic estimate. Update \"userLevel\" if their last messages clearly indicate a different level.";
  return [
    "CURRENT USER PROFILE — use it to calibrate i+1 scaffolding and to personalize the follow-up question:",
    `- Name: ${name}`,
    `- Target level: ${level}`,
    `- Known interests: ${interests}`,
    lockedNote,
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
      inputLang?: InputLang;
    };

    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return NextResponse.json(
        { error: "Thiếu trường 'messages'." },
        { status: 400 }
      );
    }

    const inputLang: InputLang = body.inputLang === "vi" ? "vi" : "en";

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
          ...(inputLang === "vi"
            ? [{ role: "system" as const, content: VI_INPUT_INSTRUCTION }]
            : []),
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

    const betterWayRaw = parsed?.betterWay;
    const bw =
      betterWayRaw && typeof betterWayRaw === "object" && !Array.isArray(betterWayRaw)
        ? {
            original: clampString((betterWayRaw as any).original),
            improved: clampString((betterWayRaw as any).improved),
          }
        : { original: "", improved: "" };
    // Chỉ trả về khi LLM thực sự đưa được cả 2 vế và chúng KHÁC nhau.
    const betterWay =
      bw.original && bw.improved && bw.original !== bw.improved
        ? bw
        : { original: "", improved: "" };

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

    const suggestions = Array.isArray(parsed?.suggestions)
      ? parsed.suggestions
          .slice(0, 3)
          .map((s: unknown) => clampString(s))
          .filter((s: string) => s.length > 0 && s.length <= 120)
      : [];

    return NextResponse.json({
      reply,
      userLevel,
      vietnamese,
      suggestion,
      betterWay,
      suggestions,
      vocabulary,
      interests,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Lỗi không xác định.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
