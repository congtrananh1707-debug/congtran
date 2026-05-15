// Explicit deletion queue — tracks rows the user deleted so that:
//   1. loadFromSupabase never restores them (even with freshLoad=true, server-wins)
//   2. pushToSupabase deletes them from Supabase regardless of rowTs state
//
// The queue is persisted to localStorage so it survives page refreshes.
// If a push fails (network down), the delete is retried on the next push.
//
// This is the primary deletion mechanism.
// Orphan-detection in pushToSupabase is only a secondary cleanup pass.

type TableName = string

const STORAGE_KEY = 'family-hub-pending-deletes'

// Module-level map: table → Set<id>
const queue = new Map<TableName, Set<string>>()

// ── Persistence ───────────────────────────────────────────────────────────────

function persistQueue(): void {
  try {
    const obj: Record<string, string[]> = {}
    for (const [table, ids] of queue.entries()) {
      if (ids.size > 0) obj[table] = [...ids]
    }
    if (Object.keys(obj).length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(obj))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  } catch { /* storage full or unavailable — ignore */ }
}

function loadPersistedQueue(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as Record<string, string[]>
    for (const [table, ids] of Object.entries(parsed)) {
      if (!Array.isArray(ids)) continue
      if (!queue.has(table)) queue.set(table, new Set())
      ids.forEach((id) => queue.get(table)!.add(id))
    }
  } catch { /* corrupted storage — ignore */ }
}

// Hydrate from localStorage when module first loads
loadPersistedQueue()

// ── Public API ────────────────────────────────────────────────────────────────

/** Register a row for deletion from Supabase. Persisted across page reloads. */
export function queueDelete(table: TableName, id: string): void {
  if (!queue.has(table)) queue.set(table, new Set())
  queue.get(table)!.add(id)
  persistQueue()
}

/** True if this row ID is pending deletion (don't restore from server). */
export function isQueued(table: TableName, id: string): boolean {
  return queue.get(table)?.has(id) ?? false
}

/** Snapshot of pending deletes: table → id[]. */
export function getQueuedDeletes(): Map<TableName, string[]> {
  const out = new Map<TableName, string[]>()
  for (const [table, ids] of queue.entries()) {
    if (ids.size > 0) out.set(table, [...ids])
  }
  return out
}

/**
 * Remove IDs from queue after Supabase DELETE confirmed.
 * Called per-table after a successful delete operation.
 */
export function confirmDeleted(table: TableName, ids: string[]): void {
  const s = queue.get(table)
  if (!s) return
  ids.forEach((id) => s.delete(id))
  if (s.size === 0) queue.delete(table)
  persistQueue()
}

/**
 * Clear entire queue and remove from localStorage.
 * Called when familyCode changes (PIN change / new session).
 * The old partition will be deleted entirely via deletePartition(),
 * so individual row queues are no longer needed.
 */
export function clearDeleteQueue(): void {
  queue.clear()
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
}
