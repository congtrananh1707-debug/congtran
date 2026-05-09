"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";

// ============================================================
// TYPES
// ============================================================

type Level = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
type OrbState = "idle" | "listening" | "waiting" | "thinking" | "speaking";

// Cấu hình cho Silence Timeout (debounce gửi câu hỏi tới Groq)
const SILENCE_MS = 2500; // 2.5s im lặng → gửi buffer
const GRACE_MS = 600; // 0.6s im lặng → bật indicator "đang chờ"

type WordBankItem = { term: string; vi: string };

type Profile = {
  name: string;
  level: Level;
  interests: string[];
  wordBank: WordBankItem[];
};

type Message = {
  role: "user" | "assistant";
  content: string;
  vietnamese?: string;
  suggestion?: string;
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

const PROFILE_KEY = "elara_profile_v1";
const ALL_LEVELS: Level[] = ["A1", "A2", "B1", "B2", "C1", "C2"];
const MAX_WORDBANK = 12;

const DEFAULT_PROFILE: Profile = {
  name: "",
  level: "A2",
  interests: [],
  wordBank: [],
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

// ============================================================
// PROFILE PERSISTENCE (LocalStorage)
// ============================================================

function loadProfile(): Profile {
  if (typeof window === "undefined") return DEFAULT_PROFILE;
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    const p = JSON.parse(raw);
    return {
      name: typeof p.name === "string" ? p.name : "",
      level: ALL_LEVELS.includes(p.level) ? p.level : "A2",
      interests: Array.isArray(p.interests)
        ? p.interests.filter((s: any) => typeof s === "string")
        : [],
      wordBank: Array.isArray(p.wordBank)
        ? p.wordBank
            .filter((w: any) => w && typeof w.term === "string")
            .map((w: any) => ({
              term: String(w.term),
              vi: typeof w.vi === "string" ? w.vi : "",
            }))
        : [],
    };
  } catch {
    return DEFAULT_PROFILE;
  }
}

function saveProfile(p: Profile) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
  } catch {
    /* quota / private mode — bỏ qua */
  }
}

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

  // ----- Hydrate profile from localStorage on mount -----
  useEffect(() => {
    const loaded = loadProfile();
    setProfile(loaded);
    profileRef.current = loaded;
  }, []);

  // ----- Persist profile + sync ref -----
  useEffect(() => {
    profileRef.current = profile;
    saveProfile(profile);
  }, [profile]);

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

  // ----- Tải voice "Google US English" nếu có -----
  useEffect(() => {
    if (typeof window === "undefined") return;
    const pickVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      voiceRef.current =
        voices.find((v) => v.name === "Google US English") ||
        voices.find(
          (v) => v.lang === "en-US" && v.name.toLowerCase().includes("google")
        ) ||
        voices.find((v) => v.lang === "en-US") ||
        voices[0] ||
        null;
    };
    pickVoice();
    window.speechSynthesis.onvoiceschanged = pickVoice;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  // ----- Tạo SpeechRecognition mới (continuous) -----
  const buildRecognition = useCallback(() => {
    if (typeof window === "undefined") return null;
    const Ctor =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) return null;
    const r = new Ctor();
    r.lang = "en-US";
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

      const clearTimers = () => {
        if (waitingTimer) {
          clearTimeout(waitingTimer);
          waitingTimer = null;
        }
        if (flushTimerRef.current) {
          clearTimeout(flushTimerRef.current);
          flushTimerRef.current = null;
        }
      };

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
      const onActivity = () => {
        // Hiện tại có hoạt động → không "đang chờ" nữa
        setIsWaiting(false);
        clearTimers();

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
            onActivity();
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
          // → khởi động lại NGAY để giữ trải nghiệm liên tục, KHÔNG flush buffer.
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
        };

        try {
          r.start();
          setIsListening(true);
        } catch {
          // InvalidStateError nếu r.start() đụng nhau — bỏ qua
        }
      };

      start();
    });
  }, [buildRecognition]);

  // ----- Robot phát âm: mic ĐÓNG cho tới khi onend hoàn tất -----
  const speak = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (!text || typeof window === "undefined") {
        resolve();
        return;
      }
      // Phòng hờ — đảm bảo không có recognition còn sống
      try {
        recognitionRef.current?.abort?.();
      } catch {
        /* noop */
      }

      const u = new SpeechSynthesisUtterance(text);
      u.voice = voiceRef.current;
      u.lang = "en-US";
      u.rate = 1;
      u.pitch = 1;

      u.onstart = () => setIsSpeaking(true);
      u.onend = () => {
        setIsSpeaking(false);
        resolve(); // Vòng lặp CHỈ tiếp tục sau khi onend kích hoạt hoàn toàn
      };
      u.onerror = () => {
        setIsSpeaking(false);
        resolve();
      };

      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
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
    } | null> => {
      const newHistory: Message[] = [
        ...historyRef.current,
        { role: "user", content: userText },
      ];

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newHistory.map(({ role, content }) => ({ role, content })),
          profile: {
            name: profileRef.current.name,
            level: profileRef.current.level,
            interests: profileRef.current.interests,
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `API error ${res.status}`);
      }

      const data = (await res.json()) as {
        reply?: string;
        userLevel?: Level;
        vietnamese?: string;
        suggestion?: string;
        vocabulary?: WordBankItem[];
        interests?: string[];
      };

      const reply = (data.reply ?? "").trim();
      const vietnamese = (data.vietnamese ?? "").trim();
      const suggestion = (data.suggestion ?? "").trim();
      const newWords = Array.isArray(data.vocabulary) ? data.vocabulary : [];
      const newInterests = Array.isArray(data.interests) ? data.interests : [];
      const nextLevel: Level = ALL_LEVELS.includes(data.userLevel as Level)
        ? (data.userLevel as Level)
        : profileRef.current.level;

      // Cập nhật profile (level + word bank + interests) → tự lưu localStorage
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

      return { reply, vietnamese, suggestion };
    },
    []
  );

  // ----- Vòng lặp: Nghe → Groq → Nói → Nghe lại -----
  const runLoop = useCallback(async () => {
    while (isActiveRef.current) {
      try {
        const userText = await listenOnce();
        if (!isActiveRef.current) break;
        if (!userText) continue;

        setHistory((h) => [...h, { role: "user", content: userText }]);

        setIsThinking(true);
        const result = await askLLM(userText);
        setIsThinking(false);
        if (!isActiveRef.current) break;
        if (!result || !result.reply) continue;

        setHistory((h) => [
          ...h,
          {
            role: "assistant",
            content: result.reply,
            vietnamese: result.vietnamese,
            suggestion: result.suggestion,
          },
        ]);
        await speak(result.reply);
      } catch (err) {
        setIsThinking(false);
        const msg = err instanceof Error ? err.message : "Lỗi không xác định";
        setError(msg);
        await new Promise((r) => setTimeout(r, 800));
      }
    }
  }, [listenOnce, askLLM, speak]);

  const startConversation = useCallback(() => {
    setError(null);
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
    if (typeof window !== "undefined") window.speechSynthesis.cancel();
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
      if (typeof window !== "undefined") window.speechSynthesis.cancel();
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

  // ----- Reset từ vựng (clear word bank) -----
  const clearWordBank = useCallback(() => {
    setProfile((p) => ({ ...p, wordBank: [], interests: [] }));
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-black text-slate-100">
      <div className="mx-auto grid w-full max-w-6xl gap-6 p-4 md:p-6 lg:grid-cols-[1fr_320px]">
        {/* MAIN */}
        <main className="flex flex-col items-center gap-4">
          {/* Header */}
          <div className="flex w-full items-start justify-between">
            <div>
              <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
                Elara
              </h1>
              <p className="text-xs text-slate-400 md:text-sm">
                Adaptive AI English tutor • Hands-free
              </p>
            </div>
            <LevelBadge level={profile.level} />
          </div>

          {/* Robot face */}
          <RobotFace state={orbState} />

          {/* Caption */}
          <div className="h-6 text-sm">
            {orbState === "idle" && (
              <span className="text-slate-300">
                Nhấn Start để bắt đầu hội thoại
              </span>
            )}
            {orbState === "listening" && (
              <span className="text-slate-300">
                {interim ? `“${interim}”` : "Đang nghe…"}
              </span>
            )}
            {orbState === "waiting" && (
              <span className="italic text-amber-300/80">
                Elara is waiting for you...
              </span>
            )}
            {orbState === "thinking" && (
              <span className="text-slate-300">Đang suy nghĩ…</span>
            )}
            {orbState === "speaking" && (
              <span className="text-slate-300">Elara đang nói…</span>
            )}
          </div>

          {/* Controls */}
          <div className="flex gap-3">
            {!isActive ? (
              <button
                onClick={startConversation}
                className="rounded-full bg-emerald-500 px-7 py-2.5 font-medium text-black shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-400"
              >
                Start
              </button>
            ) : (
              <button
                onClick={stopConversation}
                className="rounded-full bg-rose-500 px-7 py-2.5 font-medium text-black shadow-lg shadow-rose-500/30 transition hover:bg-rose-400"
              >
                Stop
              </button>
            )}
          </div>

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
              level={profile.level}
              chatEndRef={chatEndRef}
            />
          </div>
        </main>

        {/* SIDEBAR */}
        <aside className="lg:sticky lg:top-6 lg:h-fit">
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
      title="Trình độ Elara đang ước lượng cho bạn"
      className={`select-none rounded-full border px-3 py-1 text-xs font-bold tracking-widest ${LEVEL_BADGE[level]}`}
    >
      {level}
    </div>
  );
}

// ============================================================
// ROBOT FACE — đầu robot trắng + tai mèo + mắt LED + miệng động
// Có hỗ trợ trạng thái "waiting" (halo ấm vàng nhạt, mắt mơ màng)
// ============================================================

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
}: {
  history: Message[];
  isSpeaking: boolean;
  level: Level;
  chatEndRef: React.RefObject<HTMLDivElement>;
}) {
  return (
    <div
      role="log"
      aria-live="polite"
      aria-label="Lịch sử hội thoại"
      className="scroll-soft h-[400px] overflow-y-auto rounded-2xl border border-white/5 bg-black/30 p-3 backdrop-blur-sm"
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
              // Mờ các tin nhắn cũ khi Elara đang nói để user tập trung
              const dim = isSpeaking && !isLast;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: dim ? 0.28 : 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                >
                  <Bubble m={m} isUser={isUser} level={level} />
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
}: {
  m: Message;
  isUser: boolean;
  level: Level;
}) {
  const [showVi, setShowVi] = useState(false);
  const beginner = isBeginner(level);
  const showViAuto = !isUser && beginner && !!m.vietnamese;
  const canTranslate = !isUser && !beginner && !!m.vietnamese;

  return (
    <div
      className={`max-w-[85%] rounded-2xl border px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
        isUser
          ? "rounded-br-sm border-sky-400/40 bg-sky-500/20 text-sky-50"
          : "rounded-bl-sm border-emerald-400/40 bg-emerald-500/15 text-emerald-50"
      }`}
    >
      <div
        className={`mb-0.5 text-[10px] font-semibold uppercase tracking-wider ${
          isUser ? "text-sky-300" : "text-emerald-300"
        }`}
      >
        {isUser ? "You" : "Elara"}
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
    </div>
  );
}

// ============================================================
// WORD BANK SIDEBAR
// ============================================================

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
    <div className="rounded-2xl border border-white/5 bg-white/5 p-4 backdrop-blur-sm">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold tracking-wide text-slate-200">
          Word Bank
        </h2>
        <span className="text-[10px] uppercase tracking-wider text-slate-500">
          {profile.wordBank.length} terms
        </span>
      </div>

      {recent.length === 0 ? (
        <div className="text-xs text-slate-500">
          Từ vựng &ldquo;xịn&rdquo; sẽ tự xuất hiện ở đây khi bạn trò chuyện.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {recent.map((w, i) => (
              <motion.li
                key={`${w.term}-${i}`}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-lg border border-white/5 bg-black/30 p-2"
              >
                <div className="text-sm font-medium text-emerald-200">
                  {w.term}
                </div>
                {w.vi && (
                  <div className="text-xs italic text-slate-400">{w.vi}</div>
                )}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      {profile.interests.length > 0 && (
        <>
          <div className="mb-2 mt-5 text-[10px] uppercase tracking-wider text-slate-500">
            Sở thích đã ghi nhận
          </div>
          <div className="flex flex-wrap gap-1.5">
            {profile.interests.slice(-6).map((it, i) => (
              <span
                key={`${it}-${i}`}
                className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-slate-300"
              >
                {it}
              </span>
            ))}
          </div>
        </>
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
