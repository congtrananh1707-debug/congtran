import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient();
  await supabase.auth.signOut();

  // Redirect back to /login after sign-out.
  const url = new URL("/login", req.url);
  return NextResponse.redirect(url, { status: 303 });
}
