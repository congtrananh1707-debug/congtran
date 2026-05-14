import { type NextRequest } from "next/server";
import { updateSession } from "./lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

// Match everything except static assets, _next internals, and the favicon.
// /api/auth/* is intentionally NOT excluded so signout still works through
// the same session pipeline, but it's allowed through because the auth-gate
// check exempts signed-in users naturally.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
