let _counter = 0

export function nanoid(): string {
  return `${Date.now().toString(36)}-${(++_counter).toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

export function formatDateTime(ts: number): string {
  return `${formatDate(ts)} ${formatTime(ts)}`
}

export function isSameDay(ts: number, dateStr: string): boolean {
  const d = new Date(ts)
  const target = new Date(dateStr)
  return d.getDate() === target.getDate() && d.getMonth() === target.getMonth()
}

export function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}

export function isOnThisDay(dateStr: string): boolean {
  const d = new Date(dateStr)
  const now = new Date()
  return d.getDate() === now.getDate() && d.getMonth() === now.getMonth()
}

export function yearsAgo(dateStr: string): number {
  const d = new Date(dateStr)
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  const notYetThisYear =
    now.getMonth() < d.getMonth() ||
    (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())
  if (notYetThisYear) age--
  return age
}

export function calcAge(birthday: string): number {
  if (!birthday) return 0
  const diff = Date.now() - new Date(birthday).getTime()
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000))
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
