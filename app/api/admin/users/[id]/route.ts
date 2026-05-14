import { NextResponse } from "next/server";
import { getCurrentAdmin } from "../../../../../lib/supabase/admin-guard";
import { createSupabaseAdminClient } from "../../../../../lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// DELETE /api/admin/users/[id] — xoá user (cascade xoá profile + messages
// nhờ FK on delete cascade trong schema).
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = params.id;
  if (!id) {
    return NextResponse.json({ error: "Missing user id" }, { status: 400 });
  }

  // Chặn admin tự xoá chính mình — phòng trường hợp khoá cửa ngoài.
  if (id === admin.id) {
    return NextResponse.json(
      { error: "Không thể xoá tài khoản admin đang đăng nhập." },
      { status: 400 }
    );
  }

  const admindb = createSupabaseAdminClient();
  const { error } = await admindb.auth.admin.deleteUser(id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
