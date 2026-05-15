import { useEffect, useRef } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { useStore } from '../store/useStore'
import { useSyncStore } from '../store/useSyncStore'
import {
  isQueued,
  getQueuedDeletes,
  confirmDeleted,
} from '../utils/deletionQueue'

// ── Module-level state ─────────────────────────────────────────────────────────
let loadInFlight     = false
let pendingLoad      = false   // FIX #2: queue a load if one is already in flight
let lastPushTime     = 0       // FIX #1: replaces justPushed — track our push timestamp
let loadSettingState = false   // true during useStore.setState inside load/push
let isOnline         = typeof navigator !== 'undefined' ? navigator.onLine : true

// Per-row push timestamps. Cleared on each new authenticated session.
// key: `${table}:${rowId}`  value: pushTime (ms epoch)
const rowTs = new Map<string, number>()

type SyncState = ReturnType<typeof useStore.getState>

// ── TABLE_MAP ─────────────────────────────────────────────────────────────────
const TABLE_MAP = [
  {
    table: 'members',
    getRows: (s: SyncState) => s.members.map((m) => ({
      id: m.id, name: m.name, role: m.role, emoji: m.emoji, color: m.color,
      birthday: m.birthday, blood_type: m.bloodType, favorite_foods: m.favoriteFoods,
      allergies: m.allergies, goals: m.goals, tokens: m.tokens, avatar_url: m.avatarUrl ?? null,
    })),
    applyRows: (rows: any[]) => ({
      members: rows.map((r) => ({
        id: r.id, name: r.name, role: r.role, emoji: r.emoji, color: r.color,
        birthday: r.birthday ?? '', bloodType: r.blood_type ?? '',
        favoriteFoods: r.favorite_foods ?? [], allergies: r.allergies ?? [],
        goals: r.goals ?? [], tokens: r.tokens ?? 0, avatarUrl: r.avatar_url ?? undefined,
      })),
    }),
  },
  {
    table: 'quests',
    getRows: (s: SyncState) => s.quests.map((q) => ({
      id: q.id, title: q.title, description: q.description, type: q.type,
      tokens: q.tokens, assigned_to: q.assignedTo, status: q.status,
      created_by: q.createdBy, completed_by: q.completedBy ?? null,
      completed_at: q.completedAt ?? null, flash_deadline: q.flashDeadline ?? null,
    })),
    applyRows: (rows: any[]) => ({
      quests: rows.map((r) => ({
        id: r.id, title: r.title, description: r.description ?? '', type: r.type,
        tokens: r.tokens ?? 0, assignedTo: r.assigned_to ?? [], status: r.status,
        createdBy: r.created_by ?? '', completedBy: r.completed_by ?? undefined,
        completedAt: r.completed_at ?? undefined, flashDeadline: r.flash_deadline ?? undefined,
      })),
    }),
  },
  {
    table: 'rewards',
    getRows: (s: SyncState) => s.rewards.map((r) => ({
      id: r.id, name: r.name, emoji: r.emoji, token_cost: r.tokenCost, active: r.active,
    })),
    applyRows: (rows: any[]) => ({
      rewards: rows.map((r) => ({
        id: r.id, name: r.name, emoji: r.emoji, tokenCost: r.token_cost ?? 0, active: r.active ?? true,
      })),
    }),
  },
  {
    table: 'health_records',
    getRows: (s: SyncState) => s.health.map((h) => ({
      id: h.id, member_id: h.memberId, date: h.date, height: h.height ?? null, weight: h.weight ?? null,
    })),
    applyRows: (rows: any[]) => ({
      health: rows.map((r) => ({
        id: r.id, memberId: r.member_id, date: r.date, height: r.height, weight: r.weight,
      })),
    }),
  },
  {
    table: 'skills',
    getRows: (s: SyncState) => s.skills.map((k) => ({
      id: k.id, member_id: k.memberId, category: k.category, name: k.name,
      icon: k.icon, achieved: k.achieved, achieved_date: k.achievedDate ?? null,
    })),
    applyRows: (rows: any[]) => ({
      skills: rows.map((r) => ({
        id: r.id, memberId: r.member_id, category: r.category, name: r.name,
        icon: r.icon ?? '🎯', achieved: r.achieved ?? false, achievedDate: r.achieved_date ?? undefined,
      })),
    }),
  },
  {
    table: 'silent_heroes',
    getRows: (s: SyncState) => s.silentHeroes.map((h) => ({
      id: h.id, member_id: h.memberId, logged_by: h.loggedBy, deed: h.deed,
      timestamp: h.timestamp, reactions: h.reactions,
    })),
    applyRows: (rows: any[]) => ({
      silentHeroes: rows.map((r) => ({
        id: r.id, memberId: r.member_id, loggedBy: r.logged_by, deed: r.deed,
        timestamp: r.timestamp, reactions: r.reactions ?? [],
      })),
    }),
  },
  {
    table: 'mail_messages',
    getRows: (s: SyncState) => s.mails.map((m) => ({
      id: m.id, from_member: m.from, to_members: m.to, subject: m.subject, body: m.body,
      mood: m.mood, timestamp: m.timestamp, read_by: m.readBy, reactions: m.reactions, replies: m.replies,
    })),
    applyRows: (rows: any[]) => ({
      mails: rows.map((r) => ({
        id: r.id, from: r.from_member, to: r.to_members ?? [], subject: r.subject ?? '',
        body: r.body ?? '', mood: r.mood, timestamp: r.timestamp, readBy: r.read_by ?? [],
        reactions: r.reactions ?? [], replies: r.replies ?? [],
      })),
    }),
  },
  {
    table: 'gratitude_notes',
    getRows: (s: SyncState) => s.gratitude.map((g) => ({
      id: g.id, from_member: g.from, to_member: g.to, message: g.message,
      color: g.color, timestamp: g.timestamp,
    })),
    applyRows: (rows: any[]) => ({
      gratitude: rows.map((r) => ({
        id: r.id, from: r.from_member, to: r.to_member, message: r.message ?? '',
        color: r.color ?? 'bg-yellow-200 border-yellow-300', timestamp: r.timestamp,
      })),
    }),
  },
  {
    table: 'wheel_items',
    getRows: (s: SyncState) => s.wheelItems.map((w) => ({
      id: w.id, category: w.category, label: w.label, emoji: w.emoji,
    })),
    applyRows: (rows: any[]) => ({
      wheelItems: rows.map((r) => ({
        id: r.id, category: r.category, label: r.label, emoji: r.emoji ?? '🎯',
      })),
    }),
  },
  {
    table: 'quiz_questions',
    getRows: (s: SyncState) => s.quizQuestions.map((q) => ({
      id: q.id, question: q.question, answers: q.answers,
      correct_index: q.correctIndex, created_by: q.createdBy,
    })),
    applyRows: (rows: any[]) => ({
      quizQuestions: rows.map((r) => ({
        id: r.id, question: r.question, answers: r.answers ?? [],
        correctIndex: r.correct_index ?? 0, createdBy: r.created_by ?? '',
      })),
    }),
  },
  {
    table: 'family_quests',
    getRows: (s: SyncState) => s.familyQuests.map((f) => ({
      id: f.id, title: f.title, description: f.description,
      target_days: f.targetDays, current_days: f.currentDays,
      start_date: f.startDate, active: f.active,
    })),
    applyRows: (rows: any[]) => ({
      familyQuests: rows.map((r) => ({
        id: r.id, title: r.title, description: r.description ?? '',
        targetDays: r.target_days ?? 7, currentDays: r.current_days ?? 0,
        startDate: r.start_date ?? '', active: r.active ?? true,
      })),
    }),
  },
  {
    table: 'albums',
    getRows: (s: SyncState) => s.albums.map((a) => ({
      id: a.id, title: a.title, date: a.date, cover_emoji: a.coverEmoji, description: a.description,
    })),
    applyRows: (rows: any[]) => ({
      albums: rows.map((r) => ({
        id: r.id, title: r.title, date: r.date ?? '', coverEmoji: r.cover_emoji ?? '📸',
        description: r.description ?? '',
      })),
    }),
  },
  {
    table: 'photos',
    getRows: (s: SyncState) => s.photos.map((p) => ({
      id: p.id, album_id: p.albumId, data_url: p.dataUrl,
      caption: p.caption, tagged_members: p.taggedMembers, date: p.date,
    })),
    applyRows: (rows: any[]) => ({
      photos: rows.map((r) => ({
        id: r.id, albumId: r.album_id, dataUrl: r.data_url,
        caption: r.caption ?? '', taggedMembers: r.tagged_members ?? [], date: r.date ?? '',
      })),
    }),
  },
  {
    table: 'vocab_words',
    getRows: (s: SyncState) => s.vocabWords.map((v) => ({
      id: v.id, word: v.word, translation: v.translation, example: v.example,
      theme: v.theme, mastered_by: v.masteredBy,
    })),
    applyRows: (rows: any[]) => ({
      vocabWords: rows.map((r) => ({
        id: r.id, word: r.word, translation: r.translation ?? '', example: r.example ?? '',
        theme: r.theme ?? 'kitchen', masteredBy: r.mastered_by ?? [],
      })),
    }),
  },
  {
    table: 'ancestors',
    getRows: (s: SyncState) => s.ancestors.map((a) => ({
      id: a.id, name: a.name, gender: a.gender, relationship: a.relationship,
      birth_year: a.birthYear ?? null, death_year: a.deathYear ?? null,
      solar_birth_date: a.solarBirthDate ?? null, solar_death_date: a.solarDeathDate ?? null,
      lunar_death_day: a.lunarDeathDay ?? null, lunar_death_month: a.lunarDeathMonth ?? null,
      biography: a.biography ?? null, photo_url: a.photoUrl ?? null,
      parent_ids: a.parentIds, spouse_id: a.spouseId ?? null,
      phone: a.phone ?? null, address: a.address ?? null,
      hometown: a.hometown ?? null, occupation: a.occupation ?? null,
    })),
    applyRows: (rows: any[]) => ({
      ancestors: rows.map((r) => ({
        id: r.id, name: r.name, gender: r.gender, relationship: r.relationship ?? '',
        birthYear: r.birth_year ?? undefined, deathYear: r.death_year ?? undefined,
        solarBirthDate: r.solar_birth_date ?? undefined, solarDeathDate: r.solar_death_date ?? undefined,
        lunarDeathDay: r.lunar_death_day ?? undefined, lunarDeathMonth: r.lunar_death_month ?? undefined,
        biography: r.biography ?? undefined, photoUrl: r.photo_url ?? undefined,
        parentIds: r.parent_ids ?? [], spouseId: r.spouse_id ?? undefined,
        phone: r.phone ?? undefined, address: r.address ?? undefined,
        hometown: r.hometown ?? undefined, occupation: r.occupation ?? undefined,
      })),
    }),
  },
  {
    table: 'anniversaries',
    getRows: (s: SyncState) => s.anniversaries.map((a) => ({
      id: a.id, name: a.name, ancestor_id: a.ancestorId ?? null, solar_date: a.solarDate ?? null,
      lunar_day: a.lunarDay, lunar_month: a.lunarMonth, notes: a.notes ?? null,
    })),
    applyRows: (rows: any[]) => ({
      anniversaries: rows.map((r) => ({
        id: r.id, name: r.name, ancestorId: r.ancestor_id ?? undefined, solarDate: r.solar_date ?? undefined,
        lunarDay: r.lunar_day, lunarMonth: r.lunar_month, notes: r.notes ?? undefined,
      })),
    }),
  },
  {
    table: 'calendar_events',
    getRows: (s: SyncState) => s.calendarEvents.map((e) => ({
      id: e.id, title: e.title, date: e.date, emoji: e.emoji, color: e.color, created_by: e.createdBy,
    })),
    applyRows: (rows: any[]) => ({
      calendarEvents: rows.map((r) => ({
        id: r.id, title: r.title, date: r.date, emoji: r.emoji ?? '📅',
        color: r.color ?? 'bg-violet-500', createdBy: r.created_by ?? '',
      })),
    }),
  },
] as const

// ── Load: Supabase → Zustand ──────────────────────────────────────────────────
//
// Per-row last-write-wins + server-authoritative deletion propagation.
//
//   • Fresh load (rowTs empty — just authenticated):
//       - Family has prior sync history on the server (app_settings.last_push_at > 0)
//         → server is fully authoritative → replace local entirely with server rows
//       - No history → first-time use of this PIN → preserve local seed data
//   • Subsequent loads (rowTs populated):
//       remote.updated_at > rowTs entry → remote is newer → take remote
//       remote.updated_at ≤ rowTs entry → local is newer → keep local
//   • Deletion propagation: a local row that is no longer on the server but
//     USED TO BE (its ID is in rowTs from a previous load/push) was deleted on
//     another device → remove it locally. This is the fix that makes deletes
//     stick across devices.
//
// CRITICAL: local rows use (currentState as any)[storeKey] NOT entry.getRows()
// because getRows() returns snake_case (for Supabase push) and mixing camelCase /
// snake_case corrupts arrays (fields like favoriteFoods, parentIds become undefined).
//
export async function loadFromSupabase(familyCode: string): Promise<boolean> {
  if (!supabase || loadInFlight) {
    // FIX #2: queue a load so we don't miss events that arrive during an active load
    pendingLoad = true
    return false
  }
  const client = supabase
  loadInFlight = true
  useSyncStore.getState().setStatus('syncing')

  try {
    // Detect "established family" so a fresh load can safely prune stale local rows.
    // app_settings.last_push_at > 0 means at least one push has succeeded for this
    // family_code → server is the source of truth, local seed data is stale.
    const { data: settings } = await client
      .from('app_settings')
      .select('last_push_at')
      .eq('family_code', familyCode)
      .maybeSingle()
    const serverHasHistory = ((settings as any)?.last_push_at ?? 0) > 0

    const updates: Partial<SyncState> = {}
    const currentState = useStore.getState()
    const freshLoad = rowTs.size === 0

    await Promise.all(
      TABLE_MAP.map(async (entry) => {
        const { data, error } = await client
          .from(entry.table)
          .select('*')
          .eq('family_code', familyCode)

        if (error) { console.warn(`[sync] load ${entry.table}:`, error.message); return }
        const serverRows = data ?? []

        const localSnakeRows = entry.getRows(currentState)
        const localIds  = new Set(localSnakeRows.map((r: any) => r.id))
        const serverIds = new Set(serverRows.map((r: any) => r.id))

        // Snapshot IDs we previously knew were on the server for this table.
        // A local row in this set that has disappeared from the server is a
        // confirmed deletion from another device → must be pruned locally.
        const prefix = `${entry.table}:`
        const prevKnownIds = new Set<string>()
        for (const k of rowTs.keys()) {
          if (k.startsWith(prefix)) prevKnownIds.add(k.slice(prefix.length))
        }

        // Never restore a row the user explicitly deleted this session,
        // even when freshLoad=true (server would otherwise win).
        const remoteWins = serverRows.filter((r: any) => {
          if (isQueued(entry.table, r.id)) return false
          if (!localIds.has(r.id)) return true
          if (freshLoad)           return true
          const localTs  = rowTs.get(`${entry.table}:${r.id}`) ?? 0
          const remoteTs = r.updated_at ?? 0
          return remoteTs > localTs
        })

        // Record every server-seen row in rowTs so that the NEXT load can detect
        // its disappearance as a deletion. Use the server timestamp so a future
        // "local is newer" comparison stays accurate.
        serverRows.forEach((r: any) => {
          const key = `${entry.table}:${r.id}`
          if (!rowTs.has(key)) rowTs.set(key, r.updated_at ?? 0)
        })

        const applied      = entry.applyRows(remoteWins) as Record<string, any[]>
        const remoteWinIds = new Set(remoteWins.map((r: any) => r.id))

        Object.keys(applied).forEach((storeKey) => {
          const localCamel: any[] = (currentState as any)[storeKey] ?? []

          const keepLocal = localCamel.filter((r: any) => {
            if (remoteWinIds.has(r.id)) return false        // replaced by remote
            if (serverIds.has(r.id))    return true         // local newer than server, keep
            // Local row is not on the server at all:
            if (isQueued(entry.table, r.id)) return false   // pending local deletion
            if (freshLoad && serverHasHistory) return false // server-authoritative wipe
            if (prevKnownIds.has(r.id))      return false   // deleted on another device
            return true                                     // brand-new local row, not yet pushed
          })

          // Only emit an update when something actually changed — both adds
          // (remoteWins) and prunes (keepLocal.length < localCamel.length) count.
          if (remoteWins.length > 0 || keepLocal.length !== localCamel.length) {
            ;(updates as any)[storeKey] = [...applied[storeKey], ...keepLocal]
          }
        })
      })
    )

    if (Object.keys(updates).length > 0) {
      loadSettingState = true
      useStore.setState((s) => ({ ...s, ...updates }))
      loadSettingState = false
    }

    useSyncStore.getState().setLastSyncAt(Date.now())
    useSyncStore.getState().setStatus('idle')
    return Object.keys(updates).length > 0
  } catch (err: any) {
    const msg = err?.message ?? 'Lỗi đồng bộ không xác định'
    console.error('[sync] load error:', msg)
    useSyncStore.getState().setError(msg)
    return false
  } finally {
    loadInFlight = false
    // FIX #2: process queued load after current one completes
    if (pendingLoad) {
      pendingLoad = false
      setTimeout(() => loadFromSupabase(familyCode), 0)
    }
  }
}

// ── Push: Zustand → Supabase ──────────────────────────────────────────────────
export type PushResult = { ok: boolean; errors: string[] }

export async function pushToSupabase(familyCode: string): Promise<PushResult> {
  if (!supabase) return { ok: false, errors: ['Supabase chưa cấu hình'] }
  if (!isOnline)  return { ok: false, errors: ['Không có kết nối mạng'] }

  const client   = supabase
  const state    = useStore.getState()
  const errors: string[] = []
  const pushTime = Date.now()

  // Record push timestamp for echo detection (FIX #1)
  lastPushTime = pushTime

  // If we detect any server-confirmed tombstones (rows previously synced but
  // now missing from the server), trigger a reload after the push so the
  // (fixed) loadFromSupabase prunes them from local state.
  let needsReload = false

  try {
    await Promise.all(
      TABLE_MAP.map(async (entry) => {
        const allLocalRows = entry.getRows(state)

        const { data: existing, error: fetchErr } = await client
          .from(entry.table).select('id').eq('family_code', familyCode)
        if (fetchErr) { errors.push(`[${entry.table}] fetch: ${fetchErr.message}`); return }

        const existingIds = new Set((existing ?? []).map((r: any) => r.id))

        // Tombstones: local rows we previously synced (in rowTs) that the server
        // no longer has → they were deleted on another device. Don't re-upload
        // them — flag for reload-driven local cleanup. This closes the race
        // window where this device pushes BEFORE realtime delivers the DELETE.
        const tombstoneIds = new Set<string>(
          allLocalRows
            .filter((r: any) =>
              rowTs.has(`${entry.table}:${r.id}`) && !existingIds.has(r.id)
            )
            .map((r: any) => r.id as string)
        )
        if (tombstoneIds.size > 0) {
          needsReload = true
          tombstoneIds.forEach((id) => rowTs.delete(`${entry.table}:${id}`))
        }

        const localRows = allLocalRows.filter((r: any) => !tombstoneIds.has(r.id))
        const localIds  = new Set(localRows.map((r: any) => r.id))

        if (localRows.length > 0) {
          const withMeta = localRows.map((r) => ({
            ...r,
            family_code: familyCode,
            updated_at: pushTime,
          }))
          const { error: upsertErr } = await client
            .from(entry.table)
            .upsert(withMeta, { onConflict: 'id,family_code' })
          if (upsertErr) { errors.push(`[${entry.table}] upsert: ${upsertErr.message}`); return }

          localRows.forEach((r) => rowTs.set(`${entry.table}:${r.id}`, pushTime))
        }

        // Secondary orphan cleanup (primary deletions handled by the queue below).
        // Skip tombstones — server already doesn't have them.
        const orphanIds = (existing ?? [])
          .map((r: any) => r.id)
          .filter((id: string) => !localIds.has(id) && !tombstoneIds.has(id))

        if (orphanIds.length > 0) {
          const { error: delErr } = await client
            .from(entry.table).delete().eq('family_code', familyCode).in('id', orphanIds)
          if (delErr) errors.push(`[${entry.table}] del: ${delErr.message}`)
        }
      })
    )

    // Process explicit user-initiated deletions from the deletion queue.
    // Runs regardless of rowTs — works even before startup push populates rowTs.
    const queuedDeletes = getQueuedDeletes()
    for (const [table, ids] of queuedDeletes.entries()) {
      const { error: delErr } = await client
        .from(table).delete().eq('family_code', familyCode).in('id', ids)
      if (delErr) {
        errors.push(`[${table}] queue-del: ${delErr.message}`)
      } else {
        confirmDeleted(table, ids)
      }
    }

    const { error: tsErr } = await client
      .from('app_settings')
      .upsert({ family_code: familyCode, last_push_at: pushTime }, { onConflict: 'family_code' })
    if (!tsErr) {
      loadSettingState = true
      useStore.setState({ lastPushAt: pushTime })
      loadSettingState = false
    }
  } catch (err: any) {
    // Network-level error (e.g. "Failed to fetch") — treat as a soft error,
    // don't crash the app, don't lose local state.
    const msg = err?.message ?? 'Lỗi kết nối mạng'
    errors.push(msg)
    console.warn('[sync] push error:', msg)
  }

  if (errors.length === 0) {
    useSyncStore.getState().setLastSyncAt(Date.now())
    useSyncStore.getState().setStatus('idle')
  } else {
    useSyncStore.getState().setError(errors[0])
  }

  // If the server had already deleted some rows we still hold locally, reload
  // so the fixed loadFromSupabase reconciliation prunes them from local state.
  if (needsReload) {
    setTimeout(() => { loadFromSupabase(familyCode).catch(console.error) }, 0)
  }

  return { ok: errors.length === 0, errors }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Delete every row belonging to `familyCode` across all data tables,
 * then remove the family registration records (families + app_settings).
 *
 * Call this AFTER pushing data to a new partition (PIN change) to ensure
 * the old partition cannot be accessed with the old PIN.
 */
export type PartitionInfo = {
  familyCode: string
  pin: string          // masked for display
  lastPushAt: number   // ms epoch
  memberCount: number  // rough indicator of which partition has real data
}

/**
 * List all family partitions in the Supabase project.
 * Uses app_settings (written by every push) as the source of truth.
 * Includes a member count so the user can identify real vs orphan partitions.
 */
export async function listPartitions(): Promise<PartitionInfo[]> {
  if (!supabase) return []
  const client = supabase

  const { data, error } = await client
    .from('app_settings')
    .select('family_code, pin, last_push_at')
    .order('last_push_at', { ascending: false })

  if (error || !data) return []

  // Fetch member counts in parallel to help identify the real partition
  const withCounts = await Promise.all(
    data.map(async (r: any) => {
      const { count } = await client
        .from('members')
        .select('id', { count: 'exact', head: true })
        .eq('family_code', r.family_code)
      return {
        familyCode: r.family_code as string,
        pin: (r.pin as string | null) ?? '????',
        lastPushAt: (r.last_push_at as number | null) ?? 0,
        memberCount: count ?? 0,
      }
    })
  )

  return withCounts
}

export async function deletePartition(
  familyCode: string
): Promise<{ ok: boolean; errors: string[] }> {
  if (!supabase) return { ok: false, errors: ['Supabase not configured'] }
  const client = supabase
  const errors: string[] = []

  // Delete all data rows (run in parallel across every table)
  await Promise.all(
    TABLE_MAP.map(async ({ table }) => {
      const { error } = await client
        .from(table)
        .delete()
        .eq('family_code', familyCode)
      if (error) errors.push(`[${table}] ${error.message}`)
    })
  )

  // Delete family registration records
  const [{ error: e1 }, { error: e2 }] = await Promise.all([
    client.from('families').delete().eq('family_code', familyCode),
    client.from('app_settings').delete().eq('family_code', familyCode),
  ])
  if (e1) errors.push(`[families] ${e1.message}`)
  if (e2) errors.push(`[app_settings] ${e2.message}`)

  return { ok: errors.length === 0, errors }
}

export async function registerFamilyPin(familyCode: string, pin: string, appName: string) {
  if (!supabase) return
  await Promise.all([
    supabase.from('app_settings').upsert(
      { family_code: familyCode, pin, app_name: appName, updated_at: new Date().toISOString() },
      { onConflict: 'family_code' }
    ),
    supabase.from('families').upsert(
      { family_code: familyCode, pin, name: appName },
      { onConflict: 'family_code' }
    ),
  ])
}

export async function checkFamilyExists(pin: string): Promise<boolean> {
  if (!supabase) return false
  const code = `fam-${pin}`
  const { data: s } = await supabase
    .from('app_settings').select('family_code').eq('family_code', code).limit(1)
  if (s && s.length > 0) return true
  const { data: f } = await supabase
    .from('families').select('family_code').eq('family_code', code).limit(1)
  return !!(f && f.length > 0)
}

/** @deprecated Use checkFamilyExists */
export async function lookupFamilyByPin(pin: string): Promise<string | null> {
  const exists = await checkFamilyExists(pin)
  return exists ? `fam-${pin}` : null
}

// ── React hook ────────────────────────────────────────────────────────────────
export function useSupabaseSync() {
  const familyCode      = useStore((s) => s.familyCode)
  const isAuthenticated = useStore((s) => s.isAuthenticated)
  const debounceRef     = useRef<ReturnType<typeof setTimeout>>()
  const channelRef      = useRef<any>(null)
  const pollRef         = useRef<ReturnType<typeof setInterval>>()
  const reconnectRef    = useRef<ReturnType<typeof setTimeout>>()  // FIX #4
  const retriesRef      = useRef(0)

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !familyCode || !isAuthenticated) return
    const client = supabase

    // Clear in-memory sync state for a fresh session. The deletion queue is
    // intentionally NOT cleared here — it's persisted to localStorage and must
    // survive F5/re-auth so that pending deletions still get pushed to the
    // server after a network failure. Clearing it caused F5 to lose unconfirmed
    // deletions and resurrect rows from the server on the next load.
    rowTs.clear()
    lastPushTime = 0
    pendingLoad  = false
    retriesRef.current = 0

    // ── FIX #5: Online / offline detection ─────────────────────────────────
    const onOnline = () => {
      isOnline = true
      useSyncStore.getState().setStatus('idle')
      // Re-sync when connection restores
      loadFromSupabase(familyCode)
        .then(() => pushToSupabase(familyCode))
        .catch(console.error)
    }
    const onOffline = () => {
      isOnline = false
      useSyncStore.getState().setStatus('offline')
    }
    window.addEventListener('online',  onOnline)
    window.addEventListener('offline', onOffline)
    // Set initial online state
    isOnline = navigator.onLine
    if (!isOnline) useSyncStore.getState().setStatus('offline')

    // ── 1. Startup: load then push ──────────────────────────────────────────
    loadFromSupabase(familyCode)
      .then(() => pushToSupabase(familyCode))
      .catch((err) => useSyncStore.getState().setError(err?.message ?? 'Startup sync failed'))

    // ── 2. Realtime channel with FIX #1 + FIX #4 ───────────────────────────
    const setupChannel = () => {
      // Use a unique channel name so re-subscription creates a fresh connection
      let channel = client.channel(`fam-rt-${familyCode}-${Date.now()}`)

      TABLE_MAP.forEach(({ table }) => {
        channel = channel.on(
          // @ts-ignore — supabase-js v2 types accept this correctly at runtime
          'postgres_changes',
          { event: '*', schema: 'public', table, filter: `family_code=eq.${familyCode}` },
          (payload: any) => {
            // FIX #1: precise echo detection using push timestamp.
            // If the incoming event's updated_at equals our last push time,
            // this is our own echo — skip it to avoid unnecessary reload.
            const evUpdatedAt = payload?.new?.updated_at
            if (evUpdatedAt && evUpdatedAt === lastPushTime) return

            if (!isOnline || loadInFlight) {
              // FIX #2: queue it — loadFromSupabase finally{} will handle it
              pendingLoad = true
              return
            }
            loadFromSupabase(familyCode).catch(console.error)
          }
        )
      })

      channelRef.current = channel.subscribe((status: string) => {
        useSyncStore.getState().setChannelConnected(status === 'SUBSCRIBED')

        if (status === 'SUBSCRIBED') {
          retriesRef.current = 0
          console.log(`[sync] Realtime ✓ family=${familyCode.slice(0, 8)}`)
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          // FIX #4: exponential backoff reconnection (2s → 4s → 8s → 16s → 32s max)
          const delay = Math.min(2000 * Math.pow(2, retriesRef.current), 32000)
          retriesRef.current++
          console.warn(`[sync] Realtime ${status} — retrying in ${delay}ms (attempt ${retriesRef.current})`)
          client.removeChannel(channelRef.current).catch(() => {})
          reconnectRef.current = setTimeout(setupChannel, delay)
        } else if (status === 'CLOSED') {
          useSyncStore.getState().setChannelConnected(false)
        }
      })
    }

    setupChannel()

    // ── 3. Polling every 5 s — fallback when realtime is down ──────────────
    pollRef.current = setInterval(async () => {
      if (document.visibilityState !== 'visible' || loadInFlight || !isOnline) return
      try {
        const { data } = await client
          .from('app_settings').select('last_push_at')
          .eq('family_code', familyCode).maybeSingle()
        const remotePushAt = (data as any)?.last_push_at ?? 0
        const localPushAt  = useStore.getState().lastPushAt ?? 0
        if (remotePushAt > localPushAt) {
          loadFromSupabase(familyCode).catch(console.error)
        }
      } catch { /* network unavailable */ }
    }, 5000)

    // ── 4. Reload when tab regains focus ────────────────────────────────────
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || loadInFlight || !isOnline) return
      loadFromSupabase(familyCode).catch(console.error)
    }
    document.addEventListener('visibilitychange', onVisible)

    // ── 5. Debounced push on local state changes ─────────────────────────────
    const unsubscribe = useStore.subscribe(() => {
      if (loadSettingState) return
      clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        if (loadInFlight || !isOnline) return
        pushToSupabase(familyCode).catch(console.error)
      }, 800)
    })

    return () => {
      client.removeChannel(channelRef.current).catch(() => {})
      clearTimeout(reconnectRef.current)
      unsubscribe()
      clearTimeout(debounceRef.current)
      clearInterval(pollRef.current)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online',  onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [familyCode, isAuthenticated])
}
