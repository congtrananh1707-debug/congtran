import { redirect } from "next/navigation";
import { getCurrentAdmin } from "../../lib/supabase/admin-guard";
import { createSupabaseAdminClient } from "../../lib/supabase/server";
import UserManager, { type AdminUser } from "./UserManager";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const admin = await getCurrentAdmin();
  if (!admin) {
    redirect("/");
  }

  const admindb = createSupabaseAdminClient();
  const { data, error } = await admindb
    .from("profiles")
    .select("user_id, username, display_name, role, created_at")
    .order("created_at", { ascending: true });

  const users: AdminUser[] =
    error || !data
      ? []
      : data.map((p: any) => ({
          id: p.user_id,
          username: p.username,
          displayName: p.display_name ?? "",
          role: p.role === "admin" ? "admin" : "user",
          createdAt: p.created_at,
        }));

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-black text-slate-100">
      <div className="mx-auto w-full max-w-4xl p-4 md:p-8">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Quản trị tài khoản</h1>
            <p className="text-sm text-slate-400">
              Đăng nhập với tư cách <span className="text-slate-200">@{admin.username}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/"
              className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-200 transition hover:border-cyan-400/60 hover:text-cyan-300"
            >
              ← Về Kong
            </a>
            <form action="/api/auth/signout" method="post">
              <button
                type="submit"
                className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition hover:border-rose-400/60 hover:text-rose-300"
              >
                Đăng xuất
              </button>
            </form>
          </div>
        </header>

        <UserManager initialUsers={users} currentAdminId={admin.id} />
      </div>
    </div>
  );
}
