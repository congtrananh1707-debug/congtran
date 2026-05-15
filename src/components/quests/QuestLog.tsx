import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../../store/useStore'
import { formatDateTime } from '../../utils/helpers'
import { isParentRole } from '../../types'
import type { QuestType } from '../../types'
import Confetti from '../ui/Confetti'

const TYPE_CONFIG: Record<QuestType, { label: string; emoji: string; color: string }> = {
  daily:   { label: 'Hàng ngày', emoji: '🔄', color: 'bg-blue-100 text-blue-700'   },
  special: { label: 'Đặc biệt',  emoji: '⭐', color: 'bg-amber-100 text-amber-700' },
  family:  { label: 'Gia đình',  emoji: '👨‍👩‍👧', color: 'bg-green-100 text-green-700' },
}

const STATUS_CONFIG = {
  active:   { label: 'Đang thực hiện',  color: 'bg-gray-100 text-gray-600'     },
  pending:  { label: 'Chờ phê duyệt',   color: 'bg-amber-100 text-amber-700'   },
  approved: { label: 'Đã duyệt ✅',     color: 'bg-green-100 text-green-700'   },
  rejected: { label: 'Bị từ chối',      color: 'bg-red-100 text-red-600'       },
}

function useCountdown() {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  return now
}

function fmtCountdown(ms: number) {
  if (ms <= 0) return 'Hết hạn'
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

type FormState = {
  title: string
  description: string
  type: QuestType
  tokens: number
  assignedTo: string[]
}

export default function QuestLog() {
  const quests         = useStore((s) => s.quests)
  const members        = useStore((s) => s.members)
  const currentMemberId= useStore((s) => s.currentMemberId)
  const addQuest       = useStore((s) => s.addQuest)
  const updateQuest    = useStore((s) => s.updateQuest)
  const completeQuest  = useStore((s) => s.completeQuest)
  const approveQuest   = useStore((s) => s.approveQuest)
  const rejectQuest    = useStore((s) => s.rejectQuest)
  const removeQuest    = useStore((s) => s.removeQuest)

  const me = members.find((m) => m.id === currentMemberId)
  const isParent = me ? isParentRole(me.role) : false

  const [filter, setFilter] = useState<'all' | QuestType | 'mine'>('mine')
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const [isFlash, setIsFlash] = useState(false)
  const [flashMinutes, setFlashMinutes] = useState(30)
  const [addDone, setAddDone] = useState(false)

  // Sensible default: first child if any, else empty (forces user choice)
  const defaultAssignee = useMemo(() => {
    const firstChild = members.find((m) => m.role === 'child')
    return firstChild?.id ?? members[0]?.id ?? ''
  }, [members])

  const emptyForm = (): FormState => ({
    title: '', description: '', type: 'daily', tokens: 10,
    assignedTo: defaultAssignee ? [defaultAssignee] : [],
  })

  const [form, setForm] = useState<FormState>(emptyForm)

  const now = useCountdown()

  const flashQuests = quests.filter((q) => q.flashDeadline && q.status === 'active')
  const filtered = quests.filter((q) => {
    if (q.flashDeadline && q.status === 'active') return false
    if (filter === 'mine') return q.assignedTo.includes(currentMemberId || '') || (isParent && q.status === 'pending')
    if (filter === 'all')  return true
    return q.type === filter
  })

  const toggleAssignee = (id: string) => {
    setForm((f) => ({
      ...f,
      assignedTo: f.assignedTo.includes(id)
        ? f.assignedTo.filter((x) => x !== id)
        : [...f.assignedTo, id],
    }))
  }

  const assignAll = () => setForm((f) => ({ ...f, assignedTo: members.map((m) => m.id) }))
  const assignNone = () => setForm((f) => ({ ...f, assignedTo: [] }))

  const openAdd = () => {
    setEditingId(null)
    setForm(emptyForm())
    setIsFlash(false)
    setShowAdd(true)
  }

  const openEdit = (questId: string) => {
    const q = quests.find((x) => x.id === questId)
    if (!q) return
    setEditingId(questId)
    setForm({
      title: q.title,
      description: q.description,
      type: q.type,
      tokens: q.tokens,
      assignedTo: q.assignedTo,
    })
    setIsFlash(!!q.flashDeadline)
    if (q.flashDeadline) {
      const remaining = Math.max(15, Math.round((q.flashDeadline - Date.now()) / 60000))
      setFlashMinutes(remaining)
    }
    setShowAdd(true)
  }

  const closeForm = () => {
    setShowAdd(false)
    setEditingId(null)
    setIsFlash(false)
    setAddDone(false)
  }

  const submit = () => {
    if (!form.title.trim() || form.assignedTo.length === 0 || addDone) return
    if (editingId) {
      updateQuest(editingId, {
        title: form.title,
        description: form.description,
        type: form.type,
        tokens: form.tokens,
        assignedTo: form.assignedTo,
        flashDeadline: isFlash ? Date.now() + flashMinutes * 60 * 1000 : undefined,
      })
    } else {
      addQuest({
        ...form,
        createdBy: currentMemberId || '',
        flashDeadline: isFlash ? Date.now() + flashMinutes * 60 * 1000 : undefined,
      })
    }
    setAddDone(true)
    setTimeout(() => {
      setForm(emptyForm())
      closeForm()
    }, 600)
  }

  const handleApprove = (id: string) => {
    approveQuest(id)
    setShowConfetti(true)
  }

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto">
      {showConfetti && <Confetti onDone={() => setShowConfetti(false)} />}

      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">⚔️ Nhật ký nhiệm vụ</h1>
          <p className="text-gray-500 text-sm">{quests.filter((q) => q.status === 'active').length} nhiệm vụ đang chờ</p>
        </div>
        {isParent && !showAdd && (
          <button onClick={openAdd} className="bg-violet-600 text-white px-4 py-2 rounded-xl font-medium text-sm hover:bg-violet-700">
            + Tạo nhiệm vụ
          </button>
        )}
      </div>

      {/* Flash Quests section */}
      <AnimatePresence>
        {flashQuests.length > 0 && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-5">
            <h2 className="text-sm font-bold text-orange-600 uppercase tracking-wide mb-2 flex items-center gap-1">
              ⚡ Flash Quest — Thưởng x2!
            </h2>
            <div className="space-y-2">
              {flashQuests.map((q) => {
                const remaining = (q.flashDeadline ?? 0) - now
                const expired = remaining <= 0
                const assignedMembers = members.filter((m) => q.assignedTo.includes(m.id))
                const canComplete = !isParent && !expired && q.status === 'active' && q.assignedTo.includes(currentMemberId || '')
                return (
                  <motion.div key={q.id}
                    className={`rounded-2xl p-4 border-2 ${expired ? 'border-gray-200 bg-gray-50 opacity-60' : 'border-orange-300 bg-orange-50'}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="text-2xl">⚡</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-gray-800">{q.title}</h3>
                          <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${expired ? 'bg-gray-200 text-gray-500' : 'bg-orange-200 text-orange-700'}`}>
                            ⏱ {fmtCountdown(remaining)}
                          </span>
                        </div>
                        {q.description && <p className="text-sm text-gray-500 mb-1">{q.description}</p>}
                        <div className="text-xs text-gray-400 flex gap-3 flex-wrap">
                          <span>🪙 {q.tokens} xu</span>
                          <span>→ {assignedMembers.map((m) => `${m.emoji} ${m.name}`).join(', ')}</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5 flex-shrink-0">
                        {canComplete && (
                          <button onClick={() => completeQuest(q.id, currentMemberId || '')}
                            className="bg-orange-500 text-white text-xs px-3 py-1.5 rounded-xl font-medium hover:bg-orange-600 active:scale-95">
                            ✅ Hoàn thành
                          </button>
                        )}
                        {isParent && (
                          <>
                            <button onClick={() => openEdit(q.id)} className="text-gray-400 hover:text-violet-600 text-xs px-2 py-1.5 rounded-xl hover:bg-violet-50">
                              ✏️
                            </button>
                            <button onClick={() => removeQuest(q.id)} className="text-gray-300 hover:text-red-400 text-xs px-2 py-1.5 rounded-xl hover:bg-red-50">
                              🗑
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add / Edit Quest Form */}
      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-md border border-gray-100 dark:border-gray-700 mb-5"
          >
            <h3 className="font-bold text-gray-700 dark:text-gray-200 mb-4">
              {editingId ? '✏️ Sửa nhiệm vụ' : '✨ Tạo nhiệm vụ mới'}
            </h3>
            <div className="space-y-3">
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Tên nhiệm vụ..." className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl p-3 text-sm" />
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Mô tả (tuỳ chọn)..." rows={2}
                className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl p-3 text-sm resize-none" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Loại</label>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as QuestType })}
                    className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl p-2.5 text-sm">
                    <option value="daily">🔄 Hàng ngày</option>
                    <option value="special">⭐ Đặc biệt</option>
                    <option value="family">👨‍👩‍👧 Gia đình</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Xu thưởng 🪙</label>
                  <input type="number" value={form.tokens} min={1}
                    onChange={(e) => setForm({ ...form, tokens: parseInt(e.target.value) || 1 })}
                    className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl p-2.5 text-sm" />
                </div>
              </div>

              {/* Assignee multi-select — shows ALL members, not just children */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-gray-400">Giao cho ({form.assignedTo.length})</label>
                  <div className="flex gap-2 text-xs">
                    <button onClick={assignAll} className="text-violet-600 hover:underline">Cả nhà</button>
                    <button onClick={assignNone} className="text-gray-400 hover:underline">Bỏ chọn</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {members.map((m) => {
                    const selected = form.assignedTo.includes(m.id)
                    return (
                      <button key={m.id} onClick={() => toggleAssignee(m.id)} type="button"
                        className={`flex items-center gap-2 p-2 rounded-xl border-2 text-sm transition-all ${
                          selected
                            ? 'border-violet-400 bg-violet-50 dark:bg-violet-900/30'
                            : 'border-gray-200 dark:border-gray-600 hover:border-violet-300'
                        }`}
                      >
                        <span className="text-lg">{m.emoji}</span>
                        <span className="text-gray-700 dark:text-gray-200 truncate">{m.name}</span>
                        {selected && <span className="ml-auto text-violet-500">✓</span>}
                      </button>
                    )
                  })}
                </div>
                {form.assignedTo.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">⚠️ Chọn ít nhất 1 thành viên</p>
                )}
              </div>

              {/* Flash Quest toggle */}
              <div className={`rounded-2xl p-3 border-2 transition-colors ${isFlash ? 'border-orange-300 bg-orange-50' : 'border-gray-200 dark:border-gray-600'}`}>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={isFlash} onChange={(e) => setIsFlash(e.target.checked)} className="w-4 h-4 accent-orange-500" />
                  <div>
                    <span className="font-medium text-gray-700 dark:text-gray-200">⚡ Flash Quest</span>
                    <p className="text-xs text-gray-400">Nhiệm vụ giới hạn thời gian, tạo sự hứng khởi!</p>
                  </div>
                </label>
                {isFlash && (
                  <div className="mt-3">
                    <label className="text-xs text-gray-400 block mb-1">Thời hạn</label>
                    <div className="flex gap-2">
                      {[15, 30, 60, 120].map((m) => (
                        <button key={m} onClick={() => setFlashMinutes(m)}
                          className={`flex-1 py-1.5 rounded-xl text-xs font-medium transition-colors ${flashMinutes === m ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-orange-100'}`}>
                          {m < 60 ? `${m} phút` : `${m / 60} giờ`}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2 justify-end">
                <button onClick={closeForm} disabled={addDone} className="text-gray-500 px-4 py-2 rounded-xl text-sm hover:bg-gray-100 disabled:opacity-40">Hủy</button>
                <button onClick={submit}
                  disabled={!form.title.trim() || form.assignedTo.length === 0 || addDone}
                  className="bg-violet-600 text-white px-4 py-2 rounded-xl font-medium text-sm hover:bg-violet-700 disabled:opacity-50 transition-all">
                  {addDone ? '✅ Đã lưu!' : editingId ? 'Lưu thay đổi' : 'Tạo nhiệm vụ'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5 overflow-x-auto">
        {[
          { key: 'mine',    label: 'Của tôi'       },
          { key: 'all',     label: 'Tất cả'         },
          { key: 'daily',   label: '🔄 Hàng ngày'   },
          { key: 'special', label: '⭐ Đặc biệt'    },
          { key: 'family',  label: '👨‍👩‍👧 Gia đình' },
        ].map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key as any)}
            className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              filter === f.key ? 'bg-violet-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Quest list */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-5xl mb-3">⚔️</p>
            <p>Không có nhiệm vụ nào</p>
          </div>
        )}
        {filtered.map((q, i) => {
          const assignedMembers = members.filter((m) => q.assignedTo.includes(m.id))
          const completedBy = members.find((m) => m.id === q.completedBy)
          const canComplete = !isParent && q.status === 'active' && q.assignedTo.includes(currentMemberId || '')
          const cfg = TYPE_CONFIG[q.type]
          const statusCfg = STATUS_CONFIG[q.status]

          return (
            <motion.div key={q.id} initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: i * 0.05 }}
              className={`bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 transition-all ${q.status === 'approved' ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start gap-3">
                <div className="text-2xl mt-0.5">{cfg.emoji}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-semibold text-gray-800 dark:text-white">{q.title}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusCfg.color}`}>{statusCfg.label}</span>
                  </div>
                  {q.description && <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">{q.description}</p>}
                  <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
                    <span>🪙 {q.tokens} xu</span>
                    <span>→ {assignedMembers.map((m) => `${m.emoji} ${m.name}`).join(', ') || '—'}</span>
                    {q.completedAt && <span>{formatDateTime(q.completedAt)}</span>}
                  </div>
                  {completedBy && q.status === 'pending' && (
                    <p className="text-xs text-amber-600 mt-1">✅ {completedBy.emoji} {completedBy.name} đã hoàn thành</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-1.5 flex-shrink-0">
                  {canComplete && (
                    <button onClick={() => completeQuest(q.id, currentMemberId || '')}
                      className="bg-emerald-500 text-white text-xs px-3 py-1.5 rounded-xl font-medium hover:bg-emerald-600 active:scale-95">
                      ✅ Hoàn thành
                    </button>
                  )}
                  {isParent && q.status === 'pending' && (
                    <>
                      <button onClick={() => handleApprove(q.id)}
                        className="bg-emerald-500 text-white text-xs px-3 py-1.5 rounded-xl font-medium hover:bg-emerald-600">
                        ✅ Duyệt
                      </button>
                      <button onClick={() => rejectQuest(q.id)}
                        className="bg-red-100 text-red-600 text-xs px-3 py-1.5 rounded-xl font-medium hover:bg-red-200">
                        ✗ Từ chối
                      </button>
                    </>
                  )}
                  {isParent && (
                    <>
                      <button onClick={() => openEdit(q.id)} className="text-gray-400 hover:text-violet-600 text-xs px-2 py-1.5 rounded-xl hover:bg-violet-50">
                        ✏️ Sửa
                      </button>
                      <button onClick={() => removeQuest(q.id)} className="text-gray-300 hover:text-red-400 text-xs px-2 py-1.5 rounded-xl hover:bg-red-50">
                        🗑
                      </button>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
