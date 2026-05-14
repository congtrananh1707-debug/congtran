"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";
import {
  isValidUsername,
  normalizeUsername,
  usernameToEmail,
} from "../../lib/supabase/config";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const nextPath = params.get("next") || "/";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const u = normalizeUsername(username);
    if (!isValidUsername(u)) {
      setError(
        "Username chỉ gồm chữ cái không dấu, số, dấu chấm/gạch dưới/gạch ngang (2–32 ký tự)."
      );
      return;
    }
    if (password.length < 6) {
      setError("Password phải có ít nhất 6 ký tự.");
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: usernameToEmail(u),
        password,
      });
      if (signInError) {
        setError("Sai username hoặc password.");
        setSubmitting(false);
        return;
      }

      // Sau khi auth xong, hỏi profile để biết role và rẽ đúng nơi.
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .single();

      const target =
        profile?.role === "admin" ? "/admin" : nextPath || "/";

      // Dùng location.replace để middleware đọc cookie mới ngay lần render kế.
      window.location.replace(target);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Không đăng nhập được."
      );
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-5 rounded-2xl border border-slate-700/60 bg-slate-900/60 p-7 shadow-2xl backdrop-blur"
      >
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
            Kong
          </h1>
          <p className="text-sm text-slate-400">
            Đăng nhập để tiếp tục luyện hội thoại.
          </p>
        </header>

        <label className="block space-y-1.5">
          <span className="text-xs uppercase tracking-wider text-slate-400">
            Username
          </span>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoFocus
            spellCheck={false}
            className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2.5 text-slate-100 outline-none focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/20"
            placeholder="username"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs uppercase tracking-wider text-slate-400">
            Password
          </span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2.5 text-slate-100 outline-none focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/20"
            placeholder="••••••••"
          />
        </label>

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200"
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-cyan-500 px-4 py-2.5 font-medium text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Đang đăng nhập…" : "Đăng nhập"}
        </button>

        <p className="text-center text-xs text-slate-500">
          Chưa có tài khoản? Liên hệ admin để được cấp.
        </p>
      </form>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
