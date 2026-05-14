"use client";

import { useState } from "react";

export type AdminUser = {
  id: string;
  username: string;
  displayName: string;
  role: "user" | "admin";
  createdAt: string;
};

export default function UserManager({
  initialUsers,
  currentAdminId,
}: {
  initialUsers: AdminUser[];
  currentAdminId: string;
}) {
  const [users, setUsers] = useState<AdminUser[]>(initialUsers);

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setCreating(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          password,
          displayName: displayName.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || `Lỗi ${res.status}`);
        return;
      }
      setUsers((prev) => [
        ...prev,
        {
          id: data.id,
          username: data.username,
          displayName: data.displayName,
          role: "user",
          createdAt: new Date().toISOString(),
        },
      ]);
      setSuccess(`Đã tạo @${data.username}.`);
      setUsername("");
      setDisplayName("");
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi không xác định.");
    } finally {
      setCreating(false);
    }
  }

  async function onDelete(user: AdminUser) {
    if (user.id === currentAdminId) return;
    const ok = window.confirm(
      `Xoá tài khoản @${user.username}? Toàn bộ lịch sử chat sẽ bị xoá theo. Không khôi phục được.`
    );
    if (!ok) return;

    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data?.error || `Lỗi xoá ${res.status}`);
      return;
    }
    setUsers((prev) => prev.filter((u) => u.id !== user.id));
    setSuccess(`Đã xoá @${user.username}.`);
  }

  return (
    <div className="mt-8 grid gap-6 md:grid-cols-[1fr_1.2fr]">
      {/* Create form */}
      <form
        onSubmit={onCreate}
        className="space-y-4 rounded-2xl border border-slate-700/60 bg-slate-900/60 p-5"
      >
        <h2 className="text-lg font-medium">Tạo tài khoản mới</h2>

        <label className="block space-y-1.5">
          <span className="text-xs uppercase tracking-wider text-slate-400">
            Username
          </span>
          <input
            type="text"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="vd: minh.nguyen"
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100 outline-none focus:border-cyan-400/60"
          />
          <span className="block text-xs text-slate-500">
            Chữ thường, số, dấu chấm / gạch dưới / gạch ngang (2–32 ký tự).
          </span>
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs uppercase tracking-wider text-slate-400">
            Tên hiển thị (tuỳ chọn)
          </span>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="vd: Minh"
            className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100 outline-none focus:border-cyan-400/60"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs uppercase tracking-wider text-slate-400">
            Password
          </span>
          <input
            type="text"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="≥ 6 ký tự"
            autoComplete="off"
            className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100 outline-none focus:border-cyan-400/60"
          />
          <span className="block text-xs text-slate-500">
            Mật khẩu hiển thị thẳng để bạn copy gửi cho user.
          </span>
        </label>

        {error && (
          <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
            {success}
          </div>
        )}

        <button
          type="submit"
          disabled={creating}
          className="w-full rounded-lg bg-cyan-500 px-4 py-2.5 font-medium text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {creating ? "Đang tạo…" : "Tạo tài khoản"}
        </button>
      </form>

      {/* Users list */}
      <section className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-5">
        <h2 className="mb-4 text-lg font-medium">
          Danh sách ({users.length})
        </h2>
        <ul className="divide-y divide-slate-800/80">
          {users.length === 0 && (
            <li className="py-4 text-sm text-slate-400">
              Chưa có tài khoản nào.
            </li>
          )}
          {users.map((u) => (
            <li
              key={u.id}
              className="flex items-center justify-between gap-3 py-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-slate-100">@{u.username}</span>
                  {u.role === "admin" && (
                    <span className="rounded border border-cyan-400/40 bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase text-cyan-200">
                      admin
                    </span>
                  )}
                </div>
                {u.displayName && u.displayName !== u.username && (
                  <div className="truncate text-xs text-slate-400">
                    {u.displayName}
                  </div>
                )}
              </div>
              {u.id !== currentAdminId ? (
                <button
                  onClick={() => onDelete(u)}
                  className="rounded-md border border-slate-700 px-2.5 py-1 text-xs text-slate-300 transition hover:border-rose-400/60 hover:text-rose-300"
                >
                  Xoá
                </button>
              ) : (
                <span className="text-xs text-slate-500">(bạn)</span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
