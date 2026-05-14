// Shared Supabase config + the username↔email mapping trick.
// We let users sign in with a USERNAME only. Internally we store each
// account in auth.users as `<username>@<USERNAME_EMAIL_DOMAIN>`.

export const USERNAME_EMAIL_DOMAIN =
  process.env.NEXT_PUBLIC_USERNAME_EMAIL_DOMAIN || "kong.local";

const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{1,31}$/;

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidUsername(raw: string): boolean {
  return USERNAME_RE.test(normalizeUsername(raw));
}

export function usernameToEmail(username: string): string {
  return `${normalizeUsername(username)}@${USERNAME_EMAIL_DOMAIN}`;
}

export function emailToUsername(email: string): string {
  const at = email.indexOf("@");
  return at > 0 ? email.slice(0, at) : email;
}
