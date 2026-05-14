// Browser-side helpers for reading/writing the user's profile + chat
// history. Each call assumes the caller is already authenticated; RLS
// enforces that the user only ever touches their own rows.

import type { SupabaseClient } from "@supabase/supabase-js";

const ALL_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type Level = (typeof ALL_LEVELS)[number];
export type InputLang = "en" | "vi" | "zh";
export type ReplyLang = "en" | "vi" | "zh";
export type InteractionMode = "voice" | "text";

const INPUT_LANGS: readonly InputLang[] = ["en", "vi", "zh"];
const REPLY_LANGS: readonly ReplyLang[] = ["en", "vi", "zh"];

export type WordBankItem = { term: string; vi: string };
export type BetterWay = { original: string; improved: string };
export type Correction = {
  original: string;
  corrected: string;
  explanation: string;
};

export type StoredProfile = {
  userId: string;
  username: string;
  displayName: string;
  role: "user" | "admin";
  level: Level;
  manualLevel: Level | null;
  interests: string[];
  inputLang: InputLang;
  replyLang: ReplyLang;
  interactionMode: InteractionMode;
  wordBank: WordBankItem[];
  // Streak — số ngày liên tiếp user có hoạt động.
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null; // ISO YYYY-MM-DD, null = chưa có turn nào.
};

export type StoredMessage = {
  id?: string;
  role: "user" | "assistant";
  content: string;
  vietnamese?: string;
  suggestion?: string;
  correction?: Correction;
  betterWay?: BetterWay;
  suggestions?: string[];
};

const MAX_HISTORY_LOAD = 60; // số message gần nhất load lên client lúc mount

function isLevel(v: unknown): v is Level {
  return typeof v === "string" && (ALL_LEVELS as readonly string[]).includes(v);
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : [];
}

function asWordBank(v: unknown): WordBankItem[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((w: any) => w && typeof w.term === "string")
    .map((w: any) => ({
      term: String(w.term),
      vi: typeof w.vi === "string" ? w.vi : "",
    }));
}

// Đọc profile của user đang đăng nhập. Trả về null nếu chưa có row
// (trường hợp lạ — admin tạo user nhưng thiếu profile).
export async function loadProfile(
  supabase: SupabaseClient
): Promise<StoredProfile | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // SELECT * — resilient nếu migration mới chưa chạy (cột reply_lang /
  // interaction_mode chưa tồn tại). Các field thiếu sẽ rơi về default.
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();
  if (error || !data) return null;

  return {
    userId: data.user_id,
    username: data.username,
    displayName: data.display_name ?? "",
    role: data.role === "admin" ? "admin" : "user",
    level: isLevel(data.level) ? data.level : "A2",
    manualLevel: isLevel(data.manual_level) ? data.manual_level : null,
    interests: asStringArray(data.interests),
    inputLang: INPUT_LANGS.includes(data.input_lang) ? data.input_lang : "en",
    replyLang: REPLY_LANGS.includes(data.reply_lang) ? data.reply_lang : "en",
    interactionMode: data.interaction_mode === "text" ? "text" : "voice",
    wordBank: asWordBank(data.word_bank),
    currentStreak:
      typeof data.current_streak === "number" ? data.current_streak : 0,
    longestStreak:
      typeof data.longest_streak === "number" ? data.longest_streak : 0,
    lastActiveDate:
      typeof data.last_active_date === "string" ? data.last_active_date : null,
  };
}

// Format YYYY-MM-DD theo giờ local — tránh lệch ngày khi user ở múi giờ khác UTC.
function todayLocalISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Tính streak mới dựa trên lần active gần nhất:
// - cùng ngày  → giữ nguyên (no-op).
// - đúng hôm qua → streak + 1.
// - cách ≥ 2 ngày → streak về 1 (mở chuỗi mới).
// - chưa có lần nào → 1.
export function nextStreak(
  prevDate: string | null,
  prevStreak: number
): { date: string; streak: number; changed: boolean } {
  const today = todayLocalISO();
  if (prevDate === today) {
    return { date: today, streak: prevStreak || 1, changed: false };
  }
  if (prevDate) {
    const prev = new Date(prevDate);
    const todayD = new Date(today);
    const diffDays = Math.round(
      (todayD.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diffDays === 1) {
      return { date: today, streak: prevStreak + 1, changed: true };
    }
  }
  return { date: today, streak: 1, changed: true };
}

// Ghi streak mới + longest_streak nếu vượt kỷ lục. Trả về { current, longest }
// sau khi cập nhật (để client cập nhật state ngay không cần re-fetch).
export async function bumpStreak(
  supabase: SupabaseClient,
  profile: Pick<
    StoredProfile,
    "userId" | "currentStreak" | "longestStreak" | "lastActiveDate"
  >
): Promise<{ currentStreak: number; longestStreak: number; date: string }> {
  const { date, streak, changed } = nextStreak(
    profile.lastActiveDate,
    profile.currentStreak
  );
  const longest = Math.max(profile.longestStreak, streak);

  // Chỉ ghi nếu có thay đổi (streak hoặc ngày). Tránh write thừa cùng ngày.
  if (changed || profile.lastActiveDate !== date) {
    await supabase
      .from("profiles")
      .update({
        last_active_date: date,
        current_streak: streak,
        longest_streak: longest,
      })
      .eq("user_id", profile.userId);
  }

  return { currentStreak: streak, longestStreak: longest, date };
}

// Ghi đè các field có thể chỉnh (không động vào username/role).
export async function saveProfile(
  supabase: SupabaseClient,
  userId: string,
  patch: Partial<
    Pick<
      StoredProfile,
      | "displayName"
      | "level"
      | "manualLevel"
      | "interests"
      | "inputLang"
      | "replyLang"
      | "interactionMode"
      | "wordBank"
    >
  >
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.displayName !== undefined) row.display_name = patch.displayName;
  if (patch.level !== undefined) row.level = patch.level;
  if (patch.manualLevel !== undefined) row.manual_level = patch.manualLevel;
  if (patch.interests !== undefined) row.interests = patch.interests;
  if (patch.inputLang !== undefined) row.input_lang = patch.inputLang;
  if (patch.replyLang !== undefined) row.reply_lang = patch.replyLang;
  if (patch.interactionMode !== undefined)
    row.interaction_mode = patch.interactionMode;
  if (patch.wordBank !== undefined) row.word_bank = patch.wordBank;
  if (Object.keys(row).length === 0) return;

  await supabase.from("profiles").update(row).eq("user_id", userId);
}

// Load N message gần nhất theo thứ tự cũ → mới (để render thẳng vào chat).
export async function loadRecentMessages(
  supabase: SupabaseClient,
  userId: string
): Promise<StoredMessage[]> {
  const { data, error } = await supabase
    .from("messages")
    .select(
      "id, role, content, vietnamese, suggestion, correction, better_way_original, better_way_improved, suggestions"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(MAX_HISTORY_LOAD);
  if (error || !data) return [];

  return data
    .map((r: any): StoredMessage => {
      const c = r.correction && typeof r.correction === "object" ? r.correction : {};
      return {
        id: r.id,
        role: r.role === "assistant" ? "assistant" : "user",
        content: r.content ?? "",
        vietnamese: r.vietnamese ?? "",
        suggestion: r.suggestion ?? "",
        correction: {
          original: typeof c.original === "string" ? c.original : "",
          corrected: typeof c.corrected === "string" ? c.corrected : "",
          explanation: typeof c.explanation === "string" ? c.explanation : "",
        },
        betterWay: {
          original: r.better_way_original ?? "",
          improved: r.better_way_improved ?? "",
        },
        suggestions: Array.isArray(r.suggestions) ? r.suggestions : [],
      };
    })
    .reverse();
}

// Insert 1 message. Fire-and-forget từ phía caller.
export async function insertMessage(
  supabase: SupabaseClient,
  userId: string,
  msg: StoredMessage
): Promise<void> {
  await supabase.from("messages").insert({
    user_id: userId,
    role: msg.role,
    content: msg.content,
    vietnamese: msg.vietnamese ?? "",
    suggestion: msg.suggestion ?? "",
    correction: msg.correction ?? {
      original: "",
      corrected: "",
      explanation: "",
    },
    better_way_original: msg.betterWay?.original ?? "",
    better_way_improved: msg.betterWay?.improved ?? "",
    suggestions: msg.suggestions ?? [],
    vocabulary: [],
  });
}
