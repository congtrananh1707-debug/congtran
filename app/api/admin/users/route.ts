import { NextResponse } from "next/server";
import { getCurrentAdmin } from "../../../../lib/supabase/admin-guard";
import { createSupabaseAdminClient } from "../../../../lib/supabase/server";
import {
  isValidUsername,
  normalizeUsername,
  usernameToEmail,
} from "../../../../lib/supabase/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/admin/users — tạo user mới.
// Body: { username, password, displayName? }
// Chỉ admin được gọi.
export async function POST(req: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const username = normalizeUsername(String(body?.username ?? ""));
  const password = String(body?.password ?? "");
  const displayName = String(body?.displayName ?? "").trim();

  if (!isValidUsername(username)) {
    return NextResponse.json(
      {
        error:
          "Username chỉ gồm chữ thường, số, dấu chấm/gạch dưới/gạch ngang (2–32 ký tự).",
      },
      { status: 400 }
    );
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: "Password phải có ít nhất 6 ký tự." },
      { status: 400 }
    );
  }

  const admindb = createSupabaseAdminClient();

  // Tạo auth user (auto-confirm để không cần xác minh email).
  const { data: created, error: createErr } = await admindb.auth.admin.createUser({
    email: usernameToEmail(username),
    password,
    email_confirm: true,
  });
  if (createErr || !created?.user) {
    const msg = createErr?.message || "Không tạo được user.";
    // Trùng username thường biểu hiện qua message của Supabase.
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // Insert profile row. Nếu bị fail thì xoá auth user vừa tạo để tránh "user mồ côi".
  const { error: profileErr } = await admindb.from("profiles").insert({
    user_id: created.user.id,
    username,
    display_name: displayName || username,
    role: "user",
  });
  if (profileErr) {
    await admindb.auth.admin.deleteUser(created.user.id);
    return NextResponse.json(
      { error: `Tạo profile thất bại: ${profileErr.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    id: created.user.id,
    username,
    displayName: displayName || username,
  });
}
