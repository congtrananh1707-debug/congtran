import { createSupabaseServerClient } from "./server";

// Trả về user nếu họ là admin, ngược lại trả null. Dùng trong các route admin
// trước khi thực hiện bất kỳ thao tác đặc quyền nào.
export async function getCurrentAdmin(): Promise<{
  id: string;
  username: string;
} | null> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("username, role")
    .eq("user_id", user.id)
    .single();
  if (error || !profile || profile.role !== "admin") return null;

  return { id: user.id, username: profile.username };
}
