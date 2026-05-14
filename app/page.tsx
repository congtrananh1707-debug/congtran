"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { createSupabaseBrowserClient } from "../lib/supabase/client";
import {
  bumpStreak,
  insertMessage,
  loadProfile as loadProfileFromDB,
  loadRecentMessages,
  saveProfile as saveProfileToDB,
} from "../lib/supabase/db";

// ============================================================
// TYPES
// ============================================================

type Level = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
type OrbState = "idle" | "listening" | "waiting" | "thinking" | "speaking";
type InputLang = "en" | "vi" | "zh";
type ReplyLang = "en" | "vi" | "zh";
type InteractionMode = "voice" | "text";

const LANG_LABEL: Record<InputLang, string> = {
  en: "English",
  vi: "Tiếng Việt",
  zh: "中文",
};
const LANG_FLAG: Record<InputLang, string> = {
  en: "🇺🇸",
  vi: "🇻🇳",
  zh: "🇨🇳",
};
const LANG_LOCALE: Record<InputLang, string> = {
  en: "en-US",
  vi: "vi-VN",
  zh: "zh-CN",
};

// Cấu hình cho Silence Timeout (debounce gửi câu hỏi tới Groq)
// Timing đã tune cho cảm giác trò chuyện tự nhiên:
// - 1200ms im lặng = đủ để Kong "biết" user đã nói xong, không cướp lời giữa câu.
// - 300ms grace = hiện indicator "đang chờ" sớm để user thấy Kong đã chú ý.
// - 25s idle = đủ thoải mái nghĩ, không dài đến mức quên đang trong hội thoại.
const SILENCE_MS = 1200;
const GRACE_MS = 300;
const IDLE_TIMEOUT_MS = 25000;

type WordBankItem = { term: string; vi: string };

type Profile = {
  name: string;
  level: Level; // mức Kong tự ước lượng theo CEFR
  manualLevel: Level | null; // user khoá level thủ công; null = để auto
  interests: string[];
  wordBank: WordBankItem[];
  inputLang: InputLang;
  replyLang: ReplyLang; // ngôn ngữ Kong trả lời (en/vi/zh)
  interactionMode: InteractionMode; // voice = hands-free, text = gõ
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null;
};

type BetterWay = { original: string; improved: string };
type Correction = {
  original: string;
  corrected: string;
  explanation: string;
};

type Message = {
  role: "user" | "assistant";
  content: string;
  vietnamese?: string;
  suggestion?: string;
  correction?: Correction;
  betterWay?: BetterWay;
  suggestions?: string[]; // gợi ý câu user có thể nói tiếp (training wheels)
};

declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

// ============================================================
// CONSTANTS
// ============================================================

const ALL_LEVELS: Level[] = ["A1", "A2", "B1", "B2", "C1", "C2"];
const MAX_WORDBANK = 12;

const DEFAULT_PROFILE: Profile = {
  name: "",
  level: "A2",
  manualLevel: null,
  interests: [],
  wordBank: [],
  inputLang: "en",
  replyLang: "en",
  interactionMode: "voice",
  currentStreak: 0,
  longestStreak: 0,
  lastActiveDate: null,
};

const LEVEL_BADGE: Record<Level, string> = {
  A1: "bg-rose-500/15 border-rose-400/40 text-rose-200",
  A2: "bg-orange-500/15 border-orange-400/40 text-orange-200",
  B1: "bg-amber-500/15 border-amber-400/40 text-amber-200",
  B2: "bg-emerald-500/15 border-emerald-400/40 text-emerald-200",
  C1: "bg-cyan-500/15 border-cyan-400/40 text-cyan-200",
  C2: "bg-violet-500/15 border-violet-400/40 text-violet-200",
};

const isBeginner = (l: Level) => l === "A1" || l === "A2";

// Gộp danh sách giữ thứ tự cũ→mới, dedupe theo key (case-insensitive), giới hạn `max`.
function mergeUnique<T>(
  prev: T[],
  next: T[],
  keyFn: (x: T) => string,
  max: number
): T[] {
  const seen = new Set(prev.map((x) => keyFn(x).toLowerCase()).filter(Boolean));
  const merged = [...prev];
  for (const item of next) {
    const k = keyFn(item).toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    merged.push(item);
  }
  return merged.length > max ? merged.slice(merged.length - max) : merged;
}

function hasTTS(): boolean {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    !!window.speechSynthesis
  );
}

function pickBestVoice(
  lang: ReplyLang = "en"
): SpeechSynthesisVoice | null {
  if (!hasTTS()) return null;
  let voices: SpeechSynthesisVoice[] = [];
  try {
    voices = window.speechSynthesis.getVoices();
  } catch {
    return null;
  }
  if (!voices.length) return null;
  if (lang === "vi") {
    return (
      voices.find(
        (v) => v.lang === "vi-VN" && v.name.toLowerCase().includes("google")
      ) ||
      voices.find((v) => v.lang === "vi-VN") ||
      voices.find((v) => v.lang.toLowerCase().startsWith("vi")) ||
      voices[0] ||
      null
    );
  }
  if (lang === "zh") {
    return (
      voices.find(
        (v) => v.lang === "zh-CN" && v.name.toLowerCase().includes("google")
      ) ||
      voices.find((v) => v.lang === "zh-CN") ||
      voices.find((v) => v.lang.toLowerCase().startsWith("zh")) ||
      voices[0] ||
      null
    );
  }
  return (
    voices.find((v) => v.name === "Google US English") ||
    voices.find(
      (v) => v.lang === "en-US" && v.name.toLowerCase().includes("google")
    ) ||
    voices.find((v) => v.lang === "en-US") ||
    voices[0] ||
    null
  );
}

// ============================================================
// PAGE
// ============================================================

export default function Page() {
  // ----- Profile (persisted) -----
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const profileRef = useRef<Profile>(DEFAULT_PROFILE);

  // ----- Conversation state -----
  const [isActive, setIsActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false); // user đã nói, đang trong cửa sổ silence 2.5s
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [history, setHistory] = useState<Message[]>([]);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);

  // ----- Refs -----
  const isActiveRef = useRef(false);
  const historyRef = useRef<Message[]>([]);
  const recognitionRef = useRef<any>(null);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  // Timer flush buffer sau 2.5s im lặng — giữ ở ref để stopConversation có thể clear
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ----- Supabase client (browser) -----
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  // ----- Phiên hiện tại (auth) — phục vụ sign-out, link admin, lưu message -----
  const [sessionUser, setSessionUser] = useState<{
    userId: string;
    username: string;
    role: "user" | "admin";
  } | null>(null);
  const sessionRef = useRef<typeof sessionUser>(null);
  useEffect(() => {
    sessionRef.current = sessionUser;
  }, [sessionUser]);

  // Cờ "đã nạp xong từ DB" — chặn save khi state mặc định vừa khởi tạo
  // (tránh ghi đè dữ liệu DB bằng DEFAULT_PROFILE trước khi load xong).
  const hydratedRef = useRef(false);

  // ----- Hydrate profile + history từ Supabase khi mount -----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await loadProfileFromDB(supabase);
      if (cancelled) return;
      if (stored) {
        const next: Profile = {
          name: stored.displayName,
          level: stored.level,
          manualLevel: stored.manualLevel,
          interests: stored.interests,
          wordBank: stored.wordBank,
          inputLang: stored.inputLang,
          replyLang: stored.replyLang,
          interactionMode: stored.interactionMode,
          currentStreak: stored.currentStreak,
          longestStreak: stored.longestStreak,
          lastActiveDate: stored.lastActiveDate,
        };
        setProfile(next);
        profileRef.current = next;
        setSessionUser({
          userId: stored.userId,
          username: stored.username,
          role: stored.role,
        });

        const msgs = await loadRecentMessages(supabase, stored.userId);
        if (!cancelled && msgs.length > 0) {
          setHistory(
            msgs.map((m) => ({
              role: m.role,
              content: m.content,
              vietnamese: m.vietnamese,
              suggestion: m.suggestion,
              correction: m.correction,
              betterWay: m.betterWay,
              suggestions: m.suggestions,
            }))
          );
        }
      }
      hydratedRef.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // ----- Persist profile + sync ref (debounced upsert vào DB) -----
  useEffect(() => {
    profileRef.current = profile;
    if (!hydratedRef.current || !sessionUser) return;
    const t = setTimeout(() => {
      void saveProfileToDB(supabase, sessionUser.userId, {
        displayName: profile.name,
        level: profile.level,
        manualLevel: profile.manualLevel,
        interests: profile.interests,
        inputLang: profile.inputLang,
        replyLang: profile.replyLang,
        interactionMode: profile.interactionMode,
        wordBank: profile.wordBank,
      });
    }, 600);
    return () => clearTimeout(t);
  }, [profile, sessionUser, supabase]);

  // ----- Sync refs với state để vòng lặp async đọc đúng giá trị -----
  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);
  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  // ----- Auto-scroll mỗi khi có tin nhắn mới -----
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [history.length]);

  // ----- Tải voice "Google US English" nếu có (mobile thường nạp async) -----
  useEffect(() => {
    // In-app browser (Zalo, Messenger, FB, …) đôi khi không có speechSynthesis
    // → bỏ qua thay vì crash toàn app.
    if (!hasTTS()) return;
    const pickVoice = () => {
      voiceRef.current = pickBestVoice();
    };
    pickVoice();
    try {
      window.speechSynthesis.onvoiceschanged = pickVoice;
    } catch {
      /* noop */
    }
    return () => {
      try {
        if (hasTTS()) window.speechSynthesis.onvoiceschanged = null;
      } catch {
        /* noop */
      }
    };
  }, []);

  // ----- Tạo SpeechRecognition mới (continuous) -----
  const buildRecognition = useCallback(() => {
    if (typeof window === "undefined") return null;
    const Ctor =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) return null;
    const r = new Ctor();
    // Đọc từ profile để toggle EN/VI có hiệu lực ngay turn kế tiếp.
    r.lang = LANG_LOCALE[profileRef.current.inputLang];
    r.continuous = true; // KHÔNG tự dừng khi user pause — ta tự quản qua silence timer
    r.interimResults = true;
    r.maxAlternatives = 1;
    return r;
  }, []);

  // ----- Lắng nghe MỘT lượt với Silence Timeout 2.5s + cộng dồn buffer -----
  // - Mọi onresult (final hay interim) đều reset silence timer.
  // - Sau 2.5s im lặng tuyệt đối + buffer có nội dung → resolve.
  // - Buffer rỗng & timer fire → bỏ qua, tiếp tục nghe.
  // - Nếu trình duyệt tự ngắt giữa chừng → tự khởi động lại recognition ngay.
  const listenOnce = useCallback((): Promise<string> => {
    return new Promise((resolve) => {
      let buffer = ""; // các đoạn isFinal cộng dồn
      let resolved = false;
      let stoppedManually = false;
      let attached: any = null;
      let waitingTimer: ReturnType<typeof setTimeout> | null = null;
      let startAttempts = 0;
      let idleTimer: ReturnType<typeof setTimeout> | null = null;

      const clearTimers = () => {
        if (waitingTimer) {
          clearTimeout(waitingTimer);
          waitingTimer = null;
        }
        if (flushTimerRef.current) {
          clearTimeout(flushTimerRef.current);
          flushTimerRef.current = null;
        }
        if (idleTimer) {
          clearTimeout(idleTimer);
          idleTimer = null;
        }
      };

      // Tự dừng toàn bộ hội thoại nếu 30s không nghe thấy bất kỳ tiếng nói nào.
      const stopForIdle = () => {
        if (resolved) return;
        resolved = true;
        stoppedManually = true;
        clearTimers();
        setIsWaiting(false);
        setIsListening(false);
        setInterim("");
        try {
          attached?.stop?.();
        } catch {
          /* noop */
        }
        recognitionRef.current = null;
        // Báo runLoop dừng vòng lặp ngay lập tức.
        isActiveRef.current = false;
        setIsActive(false);
        setError(
          "Đã tự dừng vì 30 giây không nghe thấy bạn nói. Bấm Start để tiếp tục."
        );
        resolve("");
      };

      const armIdleTimer = () => {
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(stopForIdle, IDLE_TIMEOUT_MS);
      };
      // Khởi động idle timer ngay khi listenOnce bắt đầu.
      armIdleTimer();

      const finalize = () => {
        if (resolved) return;
        resolved = true;
        stoppedManually = true;
        clearTimers();
        setIsWaiting(false);
        setIsListening(false);
        setInterim("");
        try {
          attached?.stop?.();
        } catch {
          /* noop */
        }
        recognitionRef.current = null;
        resolve(buffer.trim());
      };

      // Mỗi khi nghe thấy hoạt động giọng nói (final hoặc interim)
      const onActivity = (_latestInterim?: string) => {
        // Hiện tại có hoạt động → không "đang chờ" nữa
        setIsWaiting(false);
        clearTimers();
        // User vẫn còn nói → reset đồng hồ đếm 30s im lặng tuyệt đối.
        armIdleTimer();

        // Sau GRACE_MS không nghe gì thêm → bật indicator "đang chờ" nếu buffer có nội dung
        waitingTimer = setTimeout(() => {
          if (buffer.trim().length > 0) setIsWaiting(true);
        }, GRACE_MS);

        // Sau SILENCE_MS không nghe gì thêm → flush buffer (chỉ khi có nội dung)
        flushTimerRef.current = setTimeout(() => {
          if (buffer.trim().length > 0) {
            finalize();
          } else {
            // User chưa kịp nói rõ ràng → tắt indicator, tiếp tục nghe
            setIsWaiting(false);
          }
        }, SILENCE_MS);
      };

      const start = () => {
        const r = buildRecognition();
        if (!r) {
          setError(
            "Trình duyệt không hỗ trợ Web Speech API. Hãy dùng Chrome/Edge."
          );
          if (!resolved) {
            resolved = true;
            resolve("");
          }
          return;
        }
        attached = r;
        recognitionRef.current = r;

        r.onresult = (event: any) => {
          let interimText = "";
          let appendedFinal = false;
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const txt = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              const cleaned = String(txt).trim();
              if (cleaned) {
                buffer += (buffer ? " " : "") + cleaned;
                appendedFinal = true;
              }
            } else {
              interimText += txt;
            }
          }
          setInterim(interimText);
          if (appendedFinal || interimText.trim().length > 0) {
            onActivity(interimText);
          }
        };

        r.onerror = (e: any) => {
          // Quyền micro: hiện lỗi rõ; các lỗi khác (no-speech, network, aborted)
          // sẽ rơi xuống onend và được xử lý tự khởi động lại.
          if (e.error === "not-allowed" || e.error === "service-not-allowed") {
            setError("Vui lòng cấp quyền sử dụng micro cho trang.");
          }
        };

        r.onend = () => {
          // Trường hợp 1: ta chủ động dừng (finalize hoặc stopConversation)
          if (stoppedManually || resolved) {
            setIsListening(false);
            setInterim("");
            recognitionRef.current = null;
            return;
          }
          // Trường hợp 2: vòng hội thoại đã bị Stop từ ngoài
          if (!isActiveRef.current) {
            resolved = true;
            clearTimers();
            setIsWaiting(false);
            setIsListening(false);
            setInterim("");
            recognitionRef.current = null;
            resolve(buffer.trim());
            return;
          }
          // Trường hợp 3: trình duyệt tự ngắt giữa chừng (no-speech, network…)
          // → đợi mic giải phóng (~150ms) rồi tạo recognition mới, KHÔNG flush buffer.
          setTimeout(() => {
            if (resolved || !isActiveRef.current) return;
            try {
              start();
            } catch {
              resolved = true;
              clearTimers();
              setIsWaiting(false);
              setIsListening(false);
              setInterim("");
              recognitionRef.current = null;
              resolve(buffer.trim());
            }
          }, 150);
        };

        try {
          r.start();
          setIsListening(true);
        } catch {
          // InvalidStateError: instance cũ chưa giải phóng mic.
          // Retry tối đa 4 lần, mỗi lần tạo recognition mới sau 250ms.
          startAttempts++;
          if (startAttempts < 4 && !resolved && isActiveRef.current) {
            setTimeout(() => {
              if (!resolved && isActiveRef.current) start();
            }, 250);
          } else if (!resolved) {
            resolved = true;
            clearTimers();
            setIsListening(false);
            setInterim("");
            recognitionRef.current = null;
            resolve(buffer.trim());
          }
        }
      };

      start();
    });
  }, [buildRecognition]);

  // ----- Robot phát âm: mic ĐÓNG cho tới khi onend hoàn tất -----
  const speak = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (!text || !hasTTS()) {
        resolve();
        return;
      }
      const synth = window.speechSynthesis;

      // Phòng hờ — đảm bảo không có recognition còn sống
      try {
        recognitionRef.current?.abort?.();
      } catch {
        /* noop */
      }

      // Chọn voice theo replyLang hiện tại — mỗi turn user có thể đã đổi mode.
      const replyLang = profileRef.current.replyLang;
      const voice = pickBestVoice(replyLang) || voiceRef.current;
      if (voice) voiceRef.current = voice;

      const u = new SpeechSynthesisUtterance(text);
      // Chỉ gán voice nếu thực sự có. iOS Safari đôi khi câm khi voice = null.
      if (voice) u.voice = voice;
      u.lang = LANG_LOCALE[replyLang];
      u.rate = 1;
      u.pitch = 1;
      u.volume = 1;

      // Android Chrome bug: speechSynthesis tự "treo" sau ~15s phát liên tục.
      // Pause/resume định kỳ để giữ phát âm thông cho câu dài.
      let resumeTimer: ReturnType<typeof setInterval> | null = null;
      const stopWatchdog = () => {
        if (resumeTimer) {
          clearInterval(resumeTimer);
          resumeTimer = null;
        }
      };

      u.onstart = () => {
        setIsSpeaking(true);
        resumeTimer = setInterval(() => {
          if (!synth.speaking) {
            stopWatchdog();
            return;
          }
          try {
            synth.pause();
            synth.resume();
          } catch {
            /* noop */
          }
        }, 10000);
      };
      u.onend = () => {
        stopWatchdog();
        setIsSpeaking(false);
        resolve(); // Vòng lặp CHỈ tiếp tục sau khi onend kích hoạt hoàn toàn
      };
      u.onerror = () => {
        stopWatchdog();
        setIsSpeaking(false);
        resolve();
      };

      // Đợi mic giải phóng audio session + clear queue cũ rồi mới speak.
      // Trên Android Chrome, cancel() và speak() gọi sát nhau hay nuốt utterance.
      setTimeout(() => {
        try {
          if (synth.speaking || synth.pending) synth.cancel();
        } catch {
          /* noop */
        }
        try {
          synth.speak(u);
        } catch {
          stopWatchdog();
          setIsSpeaking(false);
          resolve();
        }
      }, 100);
    });
  }, []);

  // ----- Gọi Groq qua API route, đồng thời cập nhật profile (level, words, interests) -----
  const askLLM = useCallback(
    async (
      userText: string
    ): Promise<{
      reply: string;
      vietnamese: string;
      suggestion: string;
      correction: Correction;
      betterWay: BetterWay;
      suggestions: string[];
    } | null> => {
      const newHistory: Message[] = [
        ...historyRef.current,
        { role: "user", content: userText },
      ];

      // Level dùng để i+1 scaffolding: nếu user chốt thủ công thì ưu tiên dùng nó.
      const effectiveLevel =
        profileRef.current.manualLevel ?? profileRef.current.level;

      // Gọi /api/chat (luôn) và /api/correct (chỉ EN mode, vì đó là feature
      // dạy tiếng Anh) SONG SONG. Llama 8B không tin cậy với correction nhồi
      // chung schema → endpoint riêng với prompt cực gọn chính xác hơn.
      // Nếu correction lỗi, không break chat — chỉ bỏ qua correction.
      const replyLang = profileRef.current.replyLang;
      const isEnglish = replyLang === "en";
      const isStart = userText === "[start]";

      const chatPromise = fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newHistory.map(({ role, content }) => ({ role, content })),
          profile: {
            name: profileRef.current.name,
            level: effectiveLevel,
            interests: profileRef.current.interests,
            levelLocked: profileRef.current.manualLevel !== null,
          },
          inputLang: profileRef.current.inputLang,
          replyLang,
        }),
      });

      const correctPromise =
        isEnglish && !isStart
          ? fetch("/api/correct", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: userText }),
            })
              .then((r) => (r.ok ? r.json() : null))
              .catch(() => null)
          : Promise.resolve(null);

      const [res, correctRes] = await Promise.all([
        chatPromise,
        correctPromise,
      ]);

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `API error ${res.status}`);
      }

      const data = (await res.json()) as {
        reply?: string;
        userLevel?: Level;
        vietnamese?: string;
        suggestion?: string;
        correction?: Correction;
        betterWay?: BetterWay;
        vocabulary?: WordBankItem[];
        interests?: string[];
        suggestions?: string[];
      };

      const reply = (data.reply ?? "").trim();
      const vietnamese = (data.vietnamese ?? "").trim();
      const suggestion = (data.suggestion ?? "").trim();
      const bw = data.betterWay;
      const betterWay: BetterWay =
        bw && typeof bw.original === "string" && typeof bw.improved === "string"
          ? { original: bw.original.trim(), improved: bw.improved.trim() }
          : { original: "", improved: "" };
      // Correction — ưu tiên kết quả từ /api/correct (endpoint chuyên dụng,
      // độ tin cậy cao hơn) nếu nó tìm được lỗi. Fallback về kết quả
      // /api/chat nếu /api/correct rỗng hoặc fail.
      const dedicated =
        correctRes &&
        typeof correctRes === "object" &&
        typeof correctRes.original === "string" &&
        typeof correctRes.corrected === "string" &&
        correctRes.original.trim() &&
        correctRes.corrected.trim() &&
        correctRes.original.trim() !== correctRes.corrected.trim()
          ? {
              original: correctRes.original.trim(),
              corrected: correctRes.corrected.trim(),
              explanation:
                typeof correctRes.explanation === "string"
                  ? correctRes.explanation.trim()
                  : "",
            }
          : null;

      const cr = data.correction;
      const fromChat: Correction =
        cr &&
        typeof cr.original === "string" &&
        typeof cr.corrected === "string" &&
        typeof cr.explanation === "string"
          ? {
              original: cr.original.trim(),
              corrected: cr.corrected.trim(),
              explanation: cr.explanation.trim(),
            }
          : { original: "", corrected: "", explanation: "" };

      const correction: Correction = dedicated ?? fromChat;
      const suggestions: string[] = Array.isArray(data.suggestions)
        ? data.suggestions
            .map((s) => (typeof s === "string" ? s.trim() : ""))
            .filter((s) => s.length > 0)
            .slice(0, 3)
        : [];
      const newWords = Array.isArray(data.vocabulary) ? data.vocabulary : [];
      const newInterests = Array.isArray(data.interests) ? data.interests : [];
      const nextLevel: Level = ALL_LEVELS.includes(data.userLevel as Level)
        ? (data.userLevel as Level)
        : profileRef.current.level;

      // Cập nhật profile. KHÔNG chạm vào manualLevel — đó là quyết định của user.
      // level (auto) vẫn được cập nhật để khi user bật lại "Auto" có giá trị mới.
      setProfile((p) => ({
        ...p,
        level: nextLevel,
        wordBank: mergeUnique(
          p.wordBank,
          newWords.filter((w) => w && w.term),
          (w) => w.term,
          MAX_WORDBANK
        ),
        interests: mergeUnique<string>(
          p.interests,
          newInterests.filter(Boolean),
          (s) => s,
          12
        ),
      }));

      return { reply, vietnamese, suggestion, correction, betterWay, suggestions };
    },
    []
  );

  // Lưu 1 message vào DB (fire-and-forget). Bỏ qua nếu chưa có session
  // hoặc nội dung rỗng / là sentinel [start].
  const persistMessage = useCallback(
    (msg: Message) => {
      const uid = sessionRef.current?.userId;
      if (!uid) return;
      if (!msg.content.trim() || msg.content === "[start]") return;
      void insertMessage(supabase, uid, {
        role: msg.role,
        content: msg.content,
        vietnamese: msg.vietnamese,
        suggestion: msg.suggestion,
        correction: msg.correction,
        betterWay: msg.betterWay,
        suggestions: msg.suggestions,
      });

      // Mỗi turn của USER mới tính như "1 lần active hôm nay" → bump streak.
      // Reply của Kong không tính (tránh inflate).
      if (msg.role === "user") {
        const p = profileRef.current;
        void bumpStreak(supabase, {
          userId: uid,
          currentStreak: p.currentStreak,
          longestStreak: p.longestStreak,
          lastActiveDate: p.lastActiveDate,
        }).then((res) => {
          // Đồng bộ state nếu có thay đổi (tránh re-render thừa khi cùng ngày).
          if (
            res.currentStreak !== p.currentStreak ||
            res.longestStreak !== p.longestStreak ||
            res.date !== p.lastActiveDate
          ) {
            setProfile((prev) => ({
              ...prev,
              currentStreak: res.currentStreak,
              longestStreak: res.longestStreak,
              lastActiveDate: res.date,
            }));
          }
        });
      }
    },
    [supabase]
  );

  // ----- Vòng lặp: Nghe → Groq → Nói → Nghe lại -----
  const runLoop = useCallback(async () => {
    // Auto-greeting: nếu mới Start (history rỗng), Kong chào trước để người mới
    // không phải đối mặt với khoảng lặng. "[start]" là marker cho backend.
    if (historyRef.current.length === 0 && isActiveRef.current) {
      try {
        setIsThinking(true);
        const greeting = await askLLM("[start]");
        setIsThinking(false);
        if (isActiveRef.current && greeting?.reply) {
          const greetingMsg: Message = {
            role: "assistant",
            content: greeting.reply,
            vietnamese: greeting.vietnamese,
            suggestion: greeting.suggestion,
            correction: greeting.correction,
            betterWay: greeting.betterWay,
            suggestions: greeting.suggestions,
          };
          setHistory((h) => [...h, greetingMsg]);
          persistMessage(greetingMsg);
          await speak(greeting.reply);
          await new Promise((r) => setTimeout(r, 250));
        }
      } catch {
        setIsThinking(false);
        // Greeting fail → bỏ qua, vào loop nghe luôn
      }
    }

    while (isActiveRef.current) {
      try {
        const userText = await listenOnce();
        if (!isActiveRef.current) break;
        if (!userText) continue;

        const userMsg: Message = { role: "user", content: userText };
        setHistory((h) => [...h, userMsg]);
        persistMessage(userMsg);

        setIsThinking(true);
        const result = await askLLM(userText);
        setIsThinking(false);
        if (!isActiveRef.current) break;
        if (!result || !result.reply) continue;

        const replyMsg: Message = {
          role: "assistant",
          content: result.reply,
          vietnamese: result.vietnamese,
          suggestion: result.suggestion,
          correction: result.correction,
          betterWay: result.betterWay,
          suggestions: result.suggestions,
        };
        setHistory((h) => [...h, replyMsg]);
        persistMessage(replyMsg);
        await speak(result.reply);
        // Mobile (đặc biệt Android Chrome) cần một nhịp để giải phóng audio
        // session sau khi loa vừa phát; không có gap này, recognition.start()
        // lần kế tiếp hay throw InvalidStateError → câm hoàn toàn từ câu thứ hai.
        await new Promise((r) => setTimeout(r, 250));
      } catch (err) {
        setIsThinking(false);
        const msg = err instanceof Error ? err.message : "Lỗi không xác định";
        setError(msg);
        await new Promise((r) => setTimeout(r, 800));
      }
    }
  }, [listenOnce, askLLM, speak, persistMessage]);

  // ----- Text mode: gửi 1 lượt rồi đợi user gõ tiếp -----
  // Khác với runLoop (voice) ở chỗ không có vòng lặp nghe — mỗi lần user nhấn
  // Send là một turn độc lập. TTS vẫn chạy để user luyện nghe.
  const sendTextMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      setError(null);

      const userMsg: Message = { role: "user", content: trimmed };
      setHistory((h) => [...h, userMsg]);
      persistMessage(userMsg);

      setIsThinking(true);
      try {
        const result = await askLLM(trimmed);
        setIsThinking(false);
        if (!result || !result.reply) return;

        const replyMsg: Message = {
          role: "assistant",
          content: result.reply,
          vietnamese: result.vietnamese,
          suggestion: result.suggestion,
          correction: result.correction,
          betterWay: result.betterWay,
          suggestions: result.suggestions,
        };
        setHistory((h) => [...h, replyMsg]);
        persistMessage(replyMsg);
        await speak(result.reply);
      } catch (err) {
        setIsThinking(false);
        setError(err instanceof Error ? err.message : "Lỗi không xác định");
      }
    },
    [askLLM, speak, persistMessage]
  );

  const startConversation = useCallback(() => {
    setError(null);

    // Mở khoá speechSynthesis bằng một utterance siêu ngắn ngay trong user gesture.
    // iOS Safari & Android Chrome chặn TTS cho tới khi có ít nhất 1 lần speak()
    // chạy trực tiếp từ tap đầu tiên — nếu không, các speak() sau (nằm sau await)
    // sẽ bị coi là không phải user gesture và câm hoàn toàn.
    if (hasTTS()) {
      try {
        const unlock = new SpeechSynthesisUtterance(" ");
        unlock.volume = 1;
        unlock.rate = 10;
        window.speechSynthesis.speak(unlock);
      } catch {
        /* noop */
      }
      // Android Chrome thường chỉ trả voices SAU user gesture đầu tiên.
      if (!voiceRef.current) voiceRef.current = pickBestVoice();
    }

    setIsActive(true);
    isActiveRef.current = true;
    void runLoop();
  }, [runLoop]);

  const stopConversation = useCallback(() => {
    setIsActive(false);
    isActiveRef.current = false;
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    try {
      recognitionRef.current?.abort?.();
    } catch {
      /* noop */
    }
    if (hasTTS()) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* noop */
      }
    }
    setIsListening(false);
    setIsWaiting(false);
    setIsSpeaking(false);
    setIsThinking(false);
    setInterim("");
  }, []);

  // ----- Cleanup unmount -----
  useEffect(() => {
    return () => {
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      try {
        recognitionRef.current?.abort?.();
      } catch {
        /* noop */
      }
      if (hasTTS()) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          /* noop */
        }
      }
    };
  }, []);

  // waiting > listening (waiting là sub-trạng thái của listening, ưu tiên hiển thị)
  const orbState: OrbState = isSpeaking
    ? "speaking"
    : isThinking
      ? "thinking"
      : isWaiting
        ? "waiting"
        : isListening
          ? "listening"
          : "idle";

  // Gợi ý câu user có thể nói tiếp — lấy từ message gần nhất của Kong.
  // Hiển thị dưới dạng floating bubbles quanh mascot (thay cho Try Saying cũ).
  const latestSuggestions = useMemo<string[]>(() => {
    for (let i = history.length - 1; i >= 0; i--) {
      const m = history[i];
      if (m.role === "assistant" && m.suggestions && m.suggestions.length > 0) {
        return m.suggestions.slice(0, 3);
      }
    }
    return [];
  }, [history]);

  // ----- Reset từ vựng (clear word bank) -----
  const clearWordBank = useCallback(() => {
    setProfile((p) => ({ ...p, wordBank: [], interests: [] }));
  }, []);

  // ----- Set ngôn ngữ mic (en / vi / zh) -----
  // Nếu đang trong hội thoại, abort recognition để turn kế tiếp tạo mới với lang đúng.
  const setInputLangValue = useCallback((lang: InputLang) => {
    setProfile((p) => ({ ...p, inputLang: lang }));
    try {
      recognitionRef.current?.abort?.();
    } catch {
      /* noop */
    }
  }, []);

  // ----- Set ngôn ngữ Kong trả lời (en / vi / zh) -----
  const setReplyLangValue = useCallback((lang: ReplyLang) => {
    setProfile((p) => ({ ...p, replyLang: lang }));
  }, []);

  // ----- Toggle mode: voice ↔ text -----
  // Nếu đang trong voice loop mà user bật text → stop conversation để mic im.
  const toggleInteractionMode = useCallback(() => {
    setProfile((p) => ({
      ...p,
      interactionMode: p.interactionMode === "voice" ? "text" : "voice",
    }));
    // Khi chuyển sang text, đảm bảo voice loop dừng hẳn.
    if (isActiveRef.current) {
      isActiveRef.current = false;
      setIsActive(false);
      try {
        recognitionRef.current?.abort?.();
      } catch {
        /* noop */
      }
      if (hasTTS()) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          /* noop */
        }
      }
      setIsListening(false);
      setIsWaiting(false);
      setIsSpeaking(false);
      setIsThinking(false);
    }
  }, []);

  // ----- Manual level picker -----
  const setManualLevel = useCallback((lvl: Level | null) => {
    setProfile((p) => ({ ...p, manualLevel: lvl }));
  }, []);

  // ----- Phát lại an toàn cho 1 đoạn TTS bất kỳ (Replay / Suggestion chip) -----
  // Pause runLoop nếu đang chạy, speak, rồi resume — tránh đụng audio session
  // và tránh recognition tự restart giữa lúc loa đang phát.
  const safeReplay = useCallback(
    async (text: string) => {
      if (!text.trim() || !hasTTS()) return;
      const wasActive = isActiveRef.current;
      if (wasActive) {
        isActiveRef.current = false;
        setIsActive(false);
        try {
          recognitionRef.current?.abort?.();
        } catch {
          /* noop */
        }
        // Cho listenOnce.onend kịp resolve và runLoop kịp break
        await new Promise((r) => setTimeout(r, 80));
      }
      await speak(text);
      if (wasActive) {
        isActiveRef.current = true;
        setIsActive(true);
        void runLoop();
      }
    },
    [speak, runLoop]
  );


  return (
    <div className="min-h-screen text-kong-ink">
      <div className="mx-auto grid w-full max-w-7xl gap-5 p-4 md:p-6 lg:grid-cols-[260px_minmax(0,1fr)_300px]">
        {/* LEFT — Progress sidebar */}
        <aside className="order-2 lg:order-1 lg:sticky lg:top-6 lg:h-fit">
          <ProgressPanel profile={profile} />
        </aside>

        {/* CENTER — Chat */}
        <main className="order-1 flex min-w-0 flex-col items-center gap-4 lg:order-2">
          {/* Header */}
          <div className="glass flex w-full items-start justify-between gap-3 rounded-2xl px-4 py-3">
            <div>
              <h1 className="font-display text-xl font-semibold tracking-tight text-kong-ink md:text-2xl">
                Kong
              </h1>
              <p className="text-xs text-kong-inkMuted md:text-sm">
                AI English Tutor
                {sessionUser ? (
                  <>
                    {" • "}
                    <span className="text-slate-300">@{sessionUser.username}</span>
                  </>
                ) : null}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <ModeToggle
                mode={profile.interactionMode}
                onToggle={toggleInteractionMode}
              />

              {/* Settings dropdown — gom Kong lang, Mic lang, Level */}
              <Dropdown
                trigger={(open) => (
                  <span
                    className={`flex select-none items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wider transition ${
                      open
                        ? "border-cyan-400/60 bg-cyan-500/15 text-cyan-100"
                        : "border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-600"
                    }`}
                  >
                    <span className="text-base leading-none">⚙️</span>
                    <span>CÀI ĐẶT</span>
                  </span>
                )}
              >
                {() => (
                  <div className="w-64 space-y-3">
                    <div>
                      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Kong trả lời bằng
                      </div>
                      <LangSegmented
                        value={profile.replyLang}
                        onChange={setReplyLangValue}
                        options={["en", "vi", "zh"] as const}
                      />
                    </div>

                    <div>
                      <div className="mb-1.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        <span>Mic nghe</span>
                        {profile.interactionMode === "text" && (
                          <span className="text-[9px] text-slate-500 normal-case">
                            (không dùng ở Text mode)
                          </span>
                        )}
                      </div>
                      <LangSegmented
                        value={profile.inputLang}
                        onChange={setInputLangValue}
                        options={["en", "vi", "zh"] as const}
                      />
                    </div>

                    <div>
                      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Mức CEFR
                      </div>
                      <LevelPicker
                        effectiveLevel={profile.manualLevel ?? profile.level}
                        manualLevel={profile.manualLevel}
                        autoLevel={profile.level}
                        onChange={setManualLevel}
                      />
                    </div>
                  </div>
                )}
              </Dropdown>

              {/* User dropdown — username + Admin link + Đăng xuất */}
              <Dropdown
                trigger={(open) => (
                  <span
                    className={`flex select-none items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wider transition ${
                      open
                        ? "border-cyan-400/60 bg-cyan-500/15 text-cyan-100"
                        : "border-slate-700 bg-slate-800/50 text-slate-200 hover:border-slate-600"
                    }`}
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-700 text-[10px] uppercase text-slate-200">
                      {sessionUser?.username?.[0] ?? "?"}
                    </span>
                    <span className="normal-case">
                      @{sessionUser?.username ?? "…"}
                    </span>
                  </span>
                )}
              >
                {(close) => (
                  <div className="w-48 space-y-1">
                    {sessionUser?.role === "admin" && (
                      <a
                        href="/admin"
                        onClick={close}
                        className="block rounded-md px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-800"
                      >
                        🛡️ Quản trị
                      </a>
                    )}
                    <form action="/api/auth/signout" method="post">
                      <button
                        type="submit"
                        className="block w-full rounded-md px-3 py-2 text-left text-sm text-rose-200 transition hover:bg-rose-500/10"
                      >
                        🚪 Đăng xuất
                      </button>
                    </form>
                  </div>
                )}
              </Dropdown>
            </div>
          </div>

          {/* Robot face + floating suggestion bubbles */}
          <div className="relative">
            <RobotFace state={orbState} />
            <FloatingSuggestions
              suggestions={latestSuggestions}
              visible={
                latestSuggestions.length > 0 &&
                orbState !== "thinking" &&
                orbState !== "speaking"
              }
              onPick={safeReplay}
            />
          </div>

          {/* Caption */}
          <div className="h-6 text-sm">
            {orbState === "idle" && profile.interactionMode === "voice" && (
              <span className="text-slate-300">
                Nhấn Start để bắt đầu hội thoại
              </span>
            )}
            {orbState === "idle" && profile.interactionMode === "text" && (
              <span className="text-slate-300">
                Gõ tin nhắn để trò chuyện với Kong
              </span>
            )}
            {orbState === "listening" && (
              <span className="text-slate-300">
                {interim
                  ? `“${interim}”`
                  : `Đang nghe (${LANG_LABEL[profile.inputLang]})…`}
              </span>
            )}
            {orbState === "waiting" && (
              <span className="italic text-amber-300/80">
                Kong is waiting for you...
              </span>
            )}
            {orbState === "thinking" && (
              <span className="text-slate-300">Đang suy nghĩ…</span>
            )}
            {orbState === "speaking" && (
              <span className="text-slate-300">Kong đang nói…</span>
            )}
          </div>

          {/* Controls */}
          {profile.interactionMode === "voice" ? (
            <div className="flex flex-wrap items-center justify-center gap-3">
              {!isActive ? (
                <button
                  onClick={startConversation}
                  className="rounded-full bg-kong-glow px-7 py-2.5 font-display font-medium text-space-900 shadow-glow-emerald transition hover:bg-kong-glowSoft hover:shadow-glow-emerald-strong"
                >
                  Start
                </button>
              ) : (
                <button
                  onClick={stopConversation}
                  className="rounded-full bg-rose-500 px-7 py-2.5 font-display font-medium text-space-900 shadow-lg shadow-rose-500/30 transition hover:bg-rose-400"
                >
                  Stop
                </button>
              )}
            </div>
          ) : (
            <TextComposer
              onSend={sendTextMessage}
              disabled={isThinking || isSpeaking}
              replyLang={profile.replyLang}
            />
          )}

          {error && (
            <p className="max-w-md text-center text-sm text-rose-400">
              {error}
            </p>
          )}

          {/* Chat history */}
          <div className="w-full">
            <ChatHistory
              history={history}
              isSpeaking={isSpeaking}
              level={profile.manualLevel ?? profile.level}
              chatEndRef={chatEndRef}
              onReplay={safeReplay}
            />
          </div>
        </main>

        {/* RIGHT — Word Bank */}
        <aside className="order-3 lg:sticky lg:top-6 lg:h-fit">
          <WordBank profile={profile} onClear={clearWordBank} />
        </aside>
      </div>
    </div>
  );
}

// ============================================================
// LEVEL BADGE
// ============================================================

function LevelBadge({ level }: { level: Level }) {
  return (
    <div
      title="Trình độ Kong đang ước lượng cho bạn"
      className={`select-none rounded-full border px-3 py-1 text-xs font-bold tracking-widest ${LEVEL_BADGE[level]}`}
    >
      {level}
    </div>
  );
}

// ============================================================
// LEVEL PICKER — user chốt mức CEFR thủ công, hoặc để Auto cho Kong tự đoán
// Dùng native <select> để mobile-friendly (hiện picker hệ thống).
// ============================================================

function LevelPicker({
  effectiveLevel,
  manualLevel,
  autoLevel,
  onChange,
}: {
  effectiveLevel: Level;
  manualLevel: Level | null;
  autoLevel: Level;
  onChange: (lvl: Level | null) => void;
}) {
  return (
    <label
      title={
        manualLevel
          ? `Bạn đang khoá ở ${manualLevel}. Chọn Auto để Kong tự đoán.`
          : `Kong tự đoán: ${autoLevel}. Bấm để chốt mức cố định.`
      }
      className={`relative inline-flex cursor-pointer select-none items-center gap-1 rounded-full border px-2 py-1 text-xs font-bold tracking-widest transition ${LEVEL_BADGE[effectiveLevel]}`}
    >
      <span>{effectiveLevel}</span>
      {!manualLevel && (
        <span className="text-[9px] font-medium opacity-60">·AUTO</span>
      )}
      <select
        value={manualLevel ?? "AUTO"}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "AUTO" ? null : (v as Level));
        }}
        className="absolute inset-0 cursor-pointer opacity-0"
        aria-label="Chọn mức CEFR"
      >
        <option value="AUTO">Auto (Kong tự đoán)</option>
        {ALL_LEVELS.map((l) => (
          <option key={l} value={l}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

// ============================================================
// HEADER CONTROLS — Dropdown helper + ModeToggle + LangSegmented
// Gộp option vào dropdown để góc phải header không bị chật.
// ============================================================

// Dropdown popover gọn: state mở/đóng + click outside auto-close.
function Dropdown({
  trigger,
  align = "right",
  children,
}: {
  trigger: (open: boolean) => React.ReactNode;
  align?: "right" | "left";
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="contents"
      >
        {trigger(open)}
      </button>
      {open && (
        <div
          className={`glass-strong absolute top-full z-[100] mt-2 w-[18rem] max-w-[calc(100vw-2rem)] rounded-xl p-3 ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

// Mode toggle: 🎤 Voice ↔ ⌨️ Text. Click để đổi mode ngay.
function ModeToggle({
  mode,
  onToggle,
}: {
  mode: InteractionMode;
  onToggle: () => void;
}) {
  const isVoice = mode === "voice";
  return (
    <button
      onClick={onToggle}
      title={
        isVoice
          ? "Đang ở chế độ Voice — bấm để chuyển sang Text"
          : "Đang ở chế độ Text — bấm để chuyển sang Voice"
      }
      className={`flex select-none items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wider transition ${
        isVoice
          ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25"
          : "border-violet-400/40 bg-violet-500/15 text-violet-200 hover:bg-violet-500/25"
      }`}
    >
      <span className="text-base leading-none">{isVoice ? "🎤" : "⌨️"}</span>
      <span>{isVoice ? "VOICE" : "TEXT"}</span>
    </button>
  );
}

// Segmented 3-way lang picker dùng bên trong Settings dropdown.
function LangSegmented<L extends InputLang>({
  value,
  onChange,
  options,
}: {
  value: L;
  onChange: (l: L) => void;
  options: readonly L[];
}) {
  return (
    <div className="flex gap-1">
      {options.map((l) => {
        const active = value === l;
        return (
          <button
            key={l}
            type="button"
            onClick={() => onChange(l)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px] font-semibold tracking-wider transition ${
              active
                ? "border-cyan-400/60 bg-cyan-500/15 text-cyan-100"
                : "border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-600"
            }`}
          >
            <span className="text-sm leading-none">{LANG_FLAG[l]}</span>
            <span>{l.toUpperCase()}</span>
          </button>
        );
      })}
    </div>
  );
}

// Text composer — input + Send button cho Text mode. Phím Enter (không có
// Shift) gửi, Shift+Enter xuống dòng. Disabled khi Kong đang suy nghĩ hoặc nói.
function TextComposer({
  onSend,
  disabled,
  replyLang,
}: {
  onSend: (text: string) => void;
  disabled: boolean;
  replyLang: ReplyLang;
}) {
  const [text, setText] = useState("");
  const placeholder =
    replyLang === "vi"
      ? "Nhắn gì đó cho Kong…"
      : replyLang === "zh"
        ? "对 Kong 说点什么…"
        : "Say something to Kong…";

  const submit = () => {
    const v = text.trim();
    if (!v || disabled) return;
    onSend(v);
    setText("");
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex w-full max-w-xl items-end gap-2"
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder={placeholder}
        rows={1}
        className="min-h-[42px] flex-1 resize-none rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-2.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/20"
      />
      <button
        type="submit"
        disabled={disabled || !text.trim()}
        className="rounded-2xl bg-cyan-500 px-5 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Send
      </button>
    </form>
  );
}

// ============================================================
// ROBOT FACE — đầu robot trắng + tai mèo + mắt LED + miệng động
// Có hỗ trợ trạng thái "waiting" (halo ấm vàng nhạt, mắt mơ màng)
// ============================================================

// Floating suggestion bubbles — bố trí 3 chip quanh Kong (trái, phải-trên,
// phải-dưới). Click → Kong đọc lại câu đó để user lặp lại. Tự động fade-in
// staggered. Ẩn khi orbState là thinking/speaking để không gây nhiễu.
function FloatingSuggestions({
  suggestions,
  visible,
  onPick,
}: {
  suggestions: string[];
  visible: boolean;
  onPick: (text: string) => void;
}) {
  // 3 vị trí cố định (top-left, top-right, bottom-right) — đủ cách mặt Kong
  // để không che mắt; trên mobile co lại vẫn nhìn được mascot.
  const POSITIONS = [
    "absolute -left-4 top-8 hidden sm:flex",
    "absolute -right-4 top-2 hidden md:flex",
    "absolute -right-2 bottom-6 hidden md:flex",
  ];

  return (
    <AnimatePresence>
      {visible &&
        suggestions.slice(0, 3).map((s, i) => (
          <motion.button
            key={`bubble-${i}-${s.slice(0, 8)}`}
            initial={{ opacity: 0, scale: 0.85, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ delay: i * 0.12, duration: 0.32, ease: "easeOut" }}
            whileHover={{ scale: 1.04, y: -2 }}
            onClick={() => onPick(s)}
            title="Bấm để Kong đọc câu này — bạn lặp lại"
            className={`${POSITIONS[i] ?? "absolute"} z-10 max-w-[180px] items-center gap-1.5 rounded-2xl border border-kong-glow/30 bg-space-800/85 px-3 py-1.5 text-left text-[11px] leading-snug text-kong-ink shadow-glow-emerald backdrop-blur-md transition hover:border-kong-glow/70 hover:bg-space-700/90 hover:shadow-glow-emerald-strong`}
          >
            <span className="text-kong-glow">🔊</span>{" "}
            <span className="break-words">{s}</span>
          </motion.button>
        ))}
    </AnimatePresence>
  );
}

function RobotFace({ state }: { state: OrbState }) {
  // Chớp mắt định kỳ khi không nói (tăng cảm giác "sống")
  const [blink, setBlink] = useState(false);
  useEffect(() => {
    if (state === "speaking") return;
    let t1: ReturnType<typeof setTimeout>;
    let t2: ReturnType<typeof setTimeout>;
    const tick = () => {
      t1 = setTimeout(() => {
        setBlink(true);
        t2 = setTimeout(() => setBlink(false), 130);
        tick();
      }, 1800 + Math.random() * 2400);
    };
    tick();
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [state]);

  const isHappy = state === "speaking";
  const isThinking = state === "thinking";
  const isListening = state === "listening";
  const isWaiting = state === "waiting";

  // Halo mát: mạnh khi speaking, yếu khi waiting (nhường chỗ halo ấm)
  const haloOpacityCool = isWaiting
    ? 0.18
    : state === "speaking"
      ? 0.7
      : state === "idle"
        ? 0.22
        : 0.45;
  const haloDur =
    state === "speaking"
      ? 0.6
      : isWaiting
        ? 2.6
        : isListening
          ? 1.4
          : 2.2;

  return (
    <div className="relative flex h-72 w-72 items-center justify-center">
      {/* Halo mát (cyan) */}
      <motion.div
        animate={{
          scale: state === "speaking" ? [1, 1.5, 1] : [1, 1.1, 1],
          opacity: haloOpacityCool,
        }}
        transition={{ duration: haloDur, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-0 rounded-full bg-cyan-400/40 blur-3xl"
      />
      {/* Halo ấm (amber) — chỉ hiện rõ khi waiting */}
      <motion.div
        initial={false}
        animate={{
          opacity: isWaiting ? [0.45, 0.65, 0.45] : 0,
          scale: isWaiting ? [1, 1.08, 1] : 1,
        }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-0 rounded-full bg-amber-300/40 blur-3xl"
      />

      {/* Khung đầu robot — bay lên xuống nhẹ */}
      <motion.div
        animate={{ y: [0, isWaiting ? -2 : -4, 0] }}
        transition={{
          duration: isWaiting ? 4.2 : 3.6,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="relative z-10 h-56 w-56"
      >
        {/* Hai tai mèo */}
        <div
          className="absolute -top-3 left-7 h-14 w-12 bg-gradient-to-b from-white to-slate-200 shadow-md"
          style={{
            clipPath: "polygon(50% 0%, 100% 100%, 0% 100%)",
            transform: "rotate(-14deg)",
          }}
        />
        <div
          className="absolute -top-3 right-7 h-14 w-12 bg-gradient-to-b from-white to-slate-200 shadow-md"
          style={{
            clipPath: "polygon(50% 0%, 100% 100%, 0% 100%)",
            transform: "rotate(14deg)",
          }}
        />

        {/* Đầu robot */}
        <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-[36%] border border-white/40 bg-gradient-to-b from-white via-slate-100 to-slate-300 shadow-2xl">
          {/* Highlight bóng phía trên */}
          <div className="absolute left-8 top-3 h-3 w-20 rounded-full bg-white/70 blur-md" />

          {/* Visor — mặt nạ tối chứa mắt */}
          <div className="relative flex h-32 w-44 items-center justify-around rounded-[42%] border border-slate-700/60 bg-gradient-to-b from-slate-900 to-black shadow-inner">
            <div className="absolute left-3 right-3 top-1.5 h-3 rounded-full bg-white/10 blur-[2px]" />
            <Eye blink={blink} happy={isHappy} thinking={isThinking} waiting={isWaiting} />
            <Eye blink={blink} happy={isHappy} thinking={isThinking} waiting={isWaiting} />
          </div>

          {/* Miệng */}
          <Mouth state={state} />

          {/* Má hồng khi vui (nói) */}
          {isHappy && (
            <>
              <div className="absolute bottom-12 left-6 h-2 w-5 rounded-full bg-rose-300/70 blur-[1px]" />
              <div className="absolute bottom-12 right-6 h-2 w-5 rounded-full bg-rose-300/70 blur-[1px]" />
            </>
          )}
        </div>

        {/* Chấm cyan trên đầu khi đang nghe */}
        {isListening && (
          <motion.div
            animate={{ scale: [1, 1.4, 1], opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -top-7 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.9)]"
          />
        )}
        {/* Chấm vàng trên đầu khi đang chờ kiên nhẫn */}
        {isWaiting && (
          <motion.div
            animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -top-7 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.9)]"
          />
        )}
      </motion.div>

      {/* Vòng lan tỏa khi đang nói */}
      {isHappy && (
        <>
          <motion.div
            initial={{ scale: 1, opacity: 0.45 }}
            animate={{ scale: 1.35, opacity: 0 }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut" }}
            className="absolute h-56 w-56 rounded-[36%] border border-cyan-300/50"
          />
          <motion.div
            initial={{ scale: 1, opacity: 0.35 }}
            animate={{ scale: 1.7, opacity: 0 }}
            transition={{
              duration: 1.6,
              repeat: Infinity,
              ease: "easeOut",
              delay: 0.45,
            }}
            className="absolute h-56 w-56 rounded-[36%] border border-cyan-300/30"
          />
        </>
      )}
    </div>
  );
}

// Một mắt LED: mở (oval cyan) thường, cong "^" khi vui, hơi mơ màng khi waiting
function Eye({
  blink,
  happy,
  thinking,
  waiting,
}: {
  blink: boolean;
  happy: boolean;
  thinking: boolean;
  waiting: boolean;
}) {
  return (
    <motion.div
      animate={{
        x: thinking ? 3 : 0,
        y: thinking ? -3 : 0,
      }}
      transition={{ duration: 0.4, ease: "easeInOut" }}
      className="relative flex h-14 w-12 items-center justify-center"
    >
      {/* Mắt mở */}
      <motion.div
        animate={{
          opacity: happy ? 0 : 1,
          // waiting → mắt khẽ híp lại như đang chăm chú lắng nghe
          scaleY: blink ? 0.06 : waiting ? 0.78 : 1,
        }}
        transition={{ duration: 0.18 }}
        className="absolute h-12 w-7 rounded-full bg-cyan-300"
        style={{
          boxShadow:
            "0 0 18px rgba(34, 211, 238, 0.95), inset 0 0 6px rgba(255,255,255,0.5)",
        }}
      >
        <div className="absolute left-1.5 top-1.5 h-2 w-2 rounded-full bg-white/90" />
        <div className="absolute bottom-2 right-1 h-1 w-1 rounded-full bg-white/70" />
      </motion.div>

      {/* Mắt cong "^" khi vui (đang nói) */}
      <motion.div
        animate={{ opacity: happy ? 1 : 0 }}
        transition={{ duration: 0.2 }}
        className="absolute h-5 w-10 rounded-t-full border-t-[5px] border-cyan-300"
        style={{ filter: "drop-shadow(0 0 8px rgba(34, 211, 238, 0.9))" }}
      />
    </motion.div>
  );
}

// Miệng theo trạng thái
function Mouth({ state }: { state: OrbState }) {
  if (state === "speaking") {
    return (
      <div className="absolute bottom-7 flex h-5 items-center gap-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <motion.span
            key={i}
            animate={{ scaleY: [0.4, 1, 0.5, 1, 0.4] }}
            transition={{
              duration: 0.55,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.07,
            }}
            className="block h-3.5 w-1 rounded bg-cyan-300"
            style={{ boxShadow: "0 0 6px rgba(34, 211, 238, 0.7)" }}
          />
        ))}
      </div>
    );
  }
  if (state === "thinking") {
    return (
      <div className="absolute bottom-8 flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            animate={{ opacity: [0.25, 1, 0.25] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.18 }}
            className="block h-1.5 w-1.5 rounded-full bg-slate-500"
          />
        ))}
      </div>
    );
  }
  if (state === "waiting") {
    return (
      <div className="absolute bottom-8 h-1 w-4 rounded-full bg-amber-300/60" />
    );
  }
  // idle / listening: gạch nhỏ
  return (
    <div className="absolute bottom-8 h-0.5 w-3 rounded bg-slate-500/80" />
  );
}

// ============================================================
// CHAT HISTORY — fixed height + dim non-latest while speaking
// ============================================================

function ChatHistory({
  history,
  isSpeaking,
  level,
  chatEndRef,
  onReplay,
}: {
  history: Message[];
  isSpeaking: boolean;
  level: Level;
  chatEndRef: React.RefObject<HTMLDivElement>;
  onReplay: (text: string) => void;
}) {
  return (
    <div
      role="log"
      aria-live="polite"
      aria-label="Lịch sử hội thoại"
      className="glass scroll-soft h-[400px] overflow-y-auto rounded-2xl p-3"
    >
      {history.length === 0 ? (
        <div className="flex h-full items-center justify-center text-sm text-slate-500">
          Bắt đầu nói để hiện tin nhắn ở đây…
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          <AnimatePresence initial={false}>
            {history.map((m, i) => {
              const isUser = m.role === "user";
              const isLast = i === history.length - 1;
              // Mờ các tin nhắn cũ khi Kong đang nói để user tập trung
              const dim = isSpeaking && !isLast;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: dim ? 0.28 : 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                >
                  <Bubble
                    m={m}
                    isUser={isUser}
                    level={level}
                    onReplay={onReplay}
                  />
                </motion.div>
              );
            })}
          </AnimatePresence>
          <div ref={chatEndRef} />
        </div>
      )}
    </div>
  );
}

function Bubble({
  m,
  isUser,
  level,
  onReplay,
}: {
  m: Message;
  isUser: boolean;
  level: Level;
  onReplay: (text: string) => void;
}) {
  const [showVi, setShowVi] = useState(false);
  const beginner = isBeginner(level);
  const showViAuto = !isUser && beginner && !!m.vietnamese;
  const canTranslate = !isUser && !beginner && !!m.vietnamese;
  // Gợi ý câu nói tiếp giờ hiển thị dạng floating bubbles quanh mascot
  // (xem <FloatingSuggestions />), không còn inline trong bubble nữa.

  return (
    <div
      className={`max-w-[85%] rounded-2xl border px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
        isUser
          ? "rounded-br-sm border-sky-400/40 bg-sky-500/20 text-sky-50"
          : "rounded-bl-sm border-emerald-400/40 bg-emerald-500/15 text-emerald-50"
      }`}
    >
      <div
        className={`mb-0.5 flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-wider ${
          isUser ? "text-sky-300" : "text-emerald-300"
        }`}
      >
        <span>{isUser ? "You" : "Kong"}</span>
        {!isUser && (
          <button
            onClick={() => onReplay(m.content)}
            title="Nghe lại câu này"
            aria-label="Nghe lại câu này"
            className="-my-1 rounded-full px-1.5 py-0.5 text-emerald-200/70 transition hover:bg-emerald-400/15 hover:text-emerald-100"
          >
            🔊
          </button>
        )}
      </div>
      <div className="text-slate-50">{m.content}</div>

      {/* Bản dịch tiếng Việt tự hiện cho A1/A2 */}
      {showViAuto && (
        <div className="mt-1 border-t border-white/5 pt-1 text-xs italic text-emerald-200/60">
          {m.vietnamese}
        </div>
      )}

      {/* Nút Translate cho B1+ — toggle bản dịch */}
      {canTranslate && (
        <div className="mt-1.5 flex items-center gap-2">
          <button
            onClick={() => setShowVi((v) => !v)}
            className="rounded-full border border-emerald-400/30 px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-emerald-200/80 transition hover:bg-emerald-400/10"
          >
            {showVi ? "Hide" : "Translate"}
          </button>
          <AnimatePresence initial={false}>
            {showVi && (
              <motion.span
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -4 }}
                className="text-xs italic text-emerald-200/70"
              >
                {m.vietnamese}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Gợi ý "Did you mean…?" — không phải sửa lỗi thô */}
      {!isUser && m.suggestion && (
        <div className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-1 text-[11px] text-amber-200/90">
          <span>💡</span>
          <span className="italic">{m.suggestion}</span>
        </div>
      )}

      {/* Correction — sửa lỗi ngữ pháp / từ vựng cho câu user vừa nói */}
      {!isUser &&
        m.correction?.original &&
        m.correction?.corrected &&
        m.correction.original !== m.correction.corrected && (
          <div className="mt-2 rounded-lg border border-rose-400/30 bg-rose-500/10 p-2.5 text-[11px] leading-relaxed">
            <div className="mb-1 font-semibold uppercase tracking-wider text-rose-200/90">
              ✏️ Câu đúng
            </div>
            <div className="text-slate-300/80 line-through decoration-rose-300/40">
              {m.correction.original}
            </div>
            <div className="mt-0.5 text-rose-50">
              → {m.correction.corrected}
            </div>
            {m.correction.explanation && (
              <div className="mt-1 text-[10px] italic text-rose-200/80">
                {m.correction.explanation}
              </div>
            )}
          </div>
        )}

      {/* "Better way to say it" — paraphrase tự nhiên hơn cho 1 câu user vừa nói */}
      {!isUser && m.betterWay?.original && m.betterWay?.improved && (
        <div className="mt-2 rounded-lg border border-fuchsia-400/30 bg-fuchsia-500/10 p-2.5 text-[11px] leading-relaxed">
          <div className="mb-1 font-semibold uppercase tracking-wider text-fuchsia-200/90">
            ✨ Better way to say it
          </div>
          <div className="text-slate-300/80 line-through decoration-fuchsia-300/40">
            {m.betterWay.original}
          </div>
          <div className="mt-0.5 text-fuchsia-100">
            → {m.betterWay.improved}
          </div>
        </div>
      )}

    </div>
  );
}

// ============================================================
// PROGRESS PANEL — Left sidebar: level, streak, interests
// ============================================================

function ProgressPanel({ profile }: { profile: Profile }) {
  const effectiveLevel = profile.manualLevel ?? profile.level;
  return (
    <div className="glass space-y-5 rounded-2xl p-4">
      {/* Level */}
      <section>
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-kong-inkSubtle">
          Cấp độ hiện tại
        </div>
        <div className="flex items-end justify-between gap-2">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-xl border font-display text-lg font-semibold ${LEVEL_BADGE[effectiveLevel]}`}
          >
            {effectiveLevel}
          </div>
          <div className="text-right text-[11px] text-kong-inkMuted">
            <div className="text-kong-inkSubtle">
              {profile.manualLevel ? "Đã khoá" : "Tự ước lượng"}
            </div>
            <div className="text-kong-ink">
              {profile.manualLevel ? "thủ công" : "(Auto)"}
            </div>
          </div>
        </div>
      </section>

      {/* Streak */}
      <section>
        <div className="mb-2 flex items-baseline justify-between text-[10px] font-semibold uppercase tracking-wider text-kong-inkSubtle">
          <span>Chuỗi ngày học</span>
          <span className="text-kong-inkMuted normal-case">
            kỷ lục {profile.longestStreak}
          </span>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-kong-border bg-space-800/40 px-3 py-2.5">
          <div className="text-3xl leading-none">🔥</div>
          <div className="flex-1">
            <div className="font-display text-2xl font-semibold leading-none text-kong-glow">
              {profile.currentStreak}
              <span className="ml-1 text-xs font-normal text-kong-inkMuted">
                ngày
              </span>
            </div>
            <div className="mt-1 text-[10px] text-kong-inkSubtle">
              {profile.currentStreak === 0
                ? "Hãy bắt đầu chuỗi đầu tiên"
                : profile.lastActiveDate
                  ? "Đã hoạt động hôm nay"
                  : "Sẵn sàng"}
            </div>
          </div>
        </div>
      </section>

      {/* Interests */}
      <section>
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-kong-inkSubtle">
          Sở thích Kong đã ghi nhận
        </div>
        {profile.interests.length === 0 ? (
          <div className="text-xs text-kong-inkMuted">
            Kong sẽ tự ghi nhớ chủ đề bạn quan tâm khi trò chuyện.
          </div>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {profile.interests.slice(0, 8).map((it, i) => (
              <li
                key={`${it}-${i}`}
                className="rounded-full border border-kong-border bg-space-700/50 px-2.5 py-1 text-[11px] text-kong-ink"
              >
                {it}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ============================================================
// WORD BANK SIDEBAR
// ============================================================

// Một thẻ từ vựng. Style "neumorphic": viền tối + inset highlight nhẹ,
// hover thì border-glow Emerald. Icon 3D nhỏ phân biệt term.
function WordBankCard({ word }: { word: WordBankItem }) {
  return (
    <motion.li
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      whileHover={{ y: -1 }}
      transition={{ duration: 0.22 }}
      className="group relative cursor-default rounded-xl border border-kong-border bg-space-800/60 p-2.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05),0_4px_12px_-6px_rgba(0,0,0,0.6)] transition hover:border-kong-glow/60 hover:shadow-glow-emerald"
    >
      <div className="flex items-start gap-2.5">
        {/* Icon "3D" — gradient orb làm mark của từ */}
        <div
          aria-hidden
          className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-kong-glow/30 to-kong-glow/0 ring-1 ring-inset ring-kong-glow/30 transition group-hover:from-kong-glow/50 group-hover:ring-kong-glow/60"
        >
          <span className="text-[10px] font-bold uppercase text-kong-glow">
            {word.term.slice(0, 1)}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-sm font-semibold text-kong-ink transition group-hover:text-kong-glowSoft">
            {word.term}
          </div>
          {word.vi && (
            <div className="truncate text-xs italic text-kong-inkMuted">
              {word.vi}
            </div>
          )}
        </div>
      </div>
    </motion.li>
  );
}

function WordBank({
  profile,
  onClear,
}: {
  profile: Profile;
  onClear: () => void;
}) {
  // Hiện 5 từ mới nhất, mới nhất đầu danh sách
  const recent = profile.wordBank.slice(-5).reverse();
  return (
    <div className="glass rounded-2xl p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-display text-sm font-semibold tracking-wide text-kong-ink">
          Word Bank
        </h2>
        <span className="text-[10px] uppercase tracking-wider text-slate-500">
          {profile.wordBank.length} terms
        </span>
      </div>

      {recent.length === 0 ? (
        <div className="text-xs text-kong-inkMuted">
          Từ vựng &ldquo;xịn&rdquo; sẽ tự xuất hiện ở đây khi bạn trò chuyện.
        </div>
      ) : (
        <ul className="flex flex-col gap-2.5">
          <AnimatePresence initial={false}>
            {recent.map((w, i) => (
              <WordBankCard key={`${w.term}-${i}`} word={w} />
            ))}
          </AnimatePresence>
        </ul>
      )}

      {(profile.wordBank.length > 0 || profile.interests.length > 0) && (
        <button
          onClick={onClear}
          className="mt-4 text-[10px] uppercase tracking-wider text-slate-500 transition hover:text-rose-300"
        >
          Clear bank
        </button>
      )}
    </div>
  );
}
