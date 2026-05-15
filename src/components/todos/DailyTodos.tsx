import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../../store/useStore'
import { isParentRole } from '../../types'
import { todayStr } from '../../utils/helpers'

const QUICK_EMOJI = ['✅', '🦷', '📚', '🧹', '🚿', '🥗', '💪', '😴', '🎵', '🏃']

export default function DailyTodos() {
  const todos             = useStore((s) => s.todos)
  const members           = useStore((s) => s.members)
  const currentMemberId   = useStore((s) => s.currentMemberId)
  const addTodo           = useStore((s) => s.addTodo)
  const updateTodo        = useStore((s) => s.updateTodo)
  const removeTodo        = useStore((s) => s.removeTodo)
  const toggleTodo        = useStore((s) => s.toggleTodo)

  const me = members.find((m) => m.id === currentMemberId)
  const isParent = me ? isParentRole(me.role) : false
  const today = todayStr()

  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('mine')

  const defaultAssignee = members.find((m) => m.role === 'child')?.id ?? members[0]?.id ?? ''
  const emptyForm = () => ({
    title: '', emoji: '✅', assignedTo: defaultAssignee ? [defaultAssignee] : [], recurring: true,
  })
  const [form, setForm] = useState<{
    title: string; emoji: string; assignedTo: string[]; recurring: boolean
  }>(emptyForm)

  const visibleTodos = useMemo(() => {
    return todos.filter((t) => {
      // Non-recurring: hide once it's been done today.
      if (!t.recurring && t.doneDates.includes(today)) return false
      if (filter === 'mine') return t.assignedTo.includes(currentMemberId || '')
      if (filter === 'all')  return true
      return t.assignedTo.includes(filter)
    })
  }, [todos, filter, currentMemberId, today])

  // Per-member completion ratio for today
  const doneToday = visibleTodos.filter((t) => t.doneDates.includes(today)).length
  const progressPct = visibleTodos.length === 0 ? 0 : Math.round((doneToday / visibleTodos.length) * 100)

  const openAdd = () => {
    setEditingId(null); setForm(emptyForm()); setShowAdd(true)
  }
  const openEdit = (id: string) => {
    const t = todos.find((x) => x.id === id)
    if (!t) return
    setEditingId(id)
    setForm({ title: t.title, emoji: t.emoji, assignedTo: t.assignedTo, recurring: t.recurring })
    setShowAdd(true)
  }
  const closeForm = () => { setShowAdd(false); setEditingId(null) }

  const toggleAssignee = (id: string) => {
    setForm((f) => ({
      ...f,
      assignedTo: f.assignedTo.includes(id) ? f.assignedTo.filter((x) => x !== id) : [...f.assignedTo, id],
    }))
  }

  const submit = () => {
    if (!form.title.trim() || form.assignedTo.length === 0) return
    if (editingId) {
      updateTodo(editingId, { title: form.title.trim(), emoji: form.emoji, assignedTo: form.assignedTo, recurring: form.recurring })
    } else {
      addTodo({ title: form.title.trim(), emoji: form.emoji, assignedTo: form.assignedTo, recurring: form.recurring, createdBy: currentMemberId || '' })
    }
    closeForm()
  }

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">📋 Việc trong ngày</h1>
          <p className="text-gray-500 text-sm">
            {visibleTodos.length === 0 ? 'Chưa có việc nào' : `${doneToday}/${visibleTodos.length} hoàn thành hôm nay`}
          </p>
        </div>
        {isParent && !showAdd && (
          <button onClick={openAdd} className="bg-violet-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-violet-700">
            + Thêm việc
          </button>
        )}
      </div>

      {/* Progress bar */}
      {visibleTodos.length > 0 && (
        <div className="bg-violet-100 dark:bg-violet-900/30 rounded-full h-2.5 mb-5 overflow-hidden">
          <motion.div
            className="bg-violet-500 h-2.5"
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      )}

      {/* Add / edit form */}
      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 mb-5"
          >
            <h3 className="font-bold text-gray-700 dark:text-gray-200 mb-3">
              {editingId ? '✏️ Sửa việc' : '✨ Thêm việc mới'}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Tên việc</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="VD: Đánh răng buổi tối" className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl p-3 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Icon</label>
                <div className="flex flex-wrap gap-2">
                  {QUICK_EMOJI.map((e) => (
                    <button key={e} onClick={() => setForm({ ...form, emoji: e })}
                      className={`text-2xl p-1.5 rounded-xl transition-all ${form.emoji === e ? 'bg-violet-100 ring-2 ring-violet-400' : 'hover:bg-gray-100'}`}>
                      {e}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Giao cho ({form.assignedTo.length})</label>
                <div className="grid grid-cols-2 gap-2">
                  {members.map((m) => {
                    const selected = form.assignedTo.includes(m.id)
                    return (
                      <button key={m.id} onClick={() => toggleAssignee(m.id)} type="button"
                        className={`flex items-center gap-2 p-2 rounded-xl border-2 text-sm transition-all ${
                          selected ? 'border-violet-400 bg-violet-50 dark:bg-violet-900/30' : 'border-gray-200 dark:border-gray-600 hover:border-violet-300'
                        }`}>
                        <span className="text-lg">{m.emoji}</span>
                        <span className="text-gray-700 dark:text-gray-200 truncate">{m.name}</span>
                        {selected && <span className="ml-auto text-violet-500">✓</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 cursor-pointer">
                <input type="checkbox" checked={form.recurring} onChange={(e) => setForm({ ...form, recurring: e.target.checked })} className="w-4 h-4 accent-violet-500" />
                Lặp lại mỗi ngày (bỏ chọn nếu là việc 1 lần)
              </label>
              <div className="flex gap-2 justify-end">
                <button onClick={closeForm} className="text-gray-500 px-4 py-2 rounded-xl text-sm hover:bg-gray-100">Hủy</button>
                <button onClick={submit} disabled={!form.title.trim() || form.assignedTo.length === 0}
                  className="bg-violet-600 text-white px-4 py-2 rounded-xl font-medium text-sm hover:bg-violet-700 disabled:opacity-50">
                  {editingId ? 'Lưu thay đổi' : 'Thêm việc'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter chips */}
      <div className="flex gap-2 mb-5 overflow-x-auto">
        <button onClick={() => setFilter('mine')}
          className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            filter === 'mine' ? 'bg-violet-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
          }`}>Của tôi</button>
        <button onClick={() => setFilter('all')}
          className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            filter === 'all' ? 'bg-violet-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
          }`}>Tất cả</button>
        {members.map((m) => (
          <button key={m.id} onClick={() => setFilter(m.id)}
            className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              filter === m.id ? 'bg-violet-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
            }`}>
            {m.emoji} {m.name}
          </button>
        ))}
      </div>

      {/* Todo list */}
      <div className="space-y-2">
        {visibleTodos.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-5xl mb-3">📋</p>
            <p>Không có việc nào</p>
            {isParent && <p className="text-sm mt-1">Bấm "+ Thêm việc" để bắt đầu</p>}
          </div>
        )}
        {visibleTodos.map((t) => {
          const doneTodayThis = t.doneDates.includes(today)
          const assignees = members.filter((m) => t.assignedTo.includes(m.id))
          return (
            <motion.div key={t.id}
              initial={{ x: -16, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
              className={`bg-white dark:bg-gray-800 rounded-2xl p-3 flex items-center gap-3 border border-gray-100 dark:border-gray-700 shadow-sm ${
                doneTodayThis ? 'opacity-60' : ''
              }`}
            >
              <button
                onClick={() => toggleTodo(t.id, today)}
                className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-xl transition-all ${
                  doneTodayThis ? 'bg-emerald-500 text-white' : 'bg-gray-100 dark:bg-gray-700 hover:bg-emerald-100'
                }`}
                title={doneTodayThis ? 'Đã hoàn thành — bấm để hoàn tác' : 'Đánh dấu hoàn thành'}
              >
                {doneTodayThis ? '✓' : t.emoji}
              </button>
              <div className="flex-1 min-w-0">
                <p className={`font-medium text-gray-800 dark:text-white ${doneTodayThis ? 'line-through' : ''}`}>
                  {t.title}
                </p>
                <p className="text-xs text-gray-400">
                  {assignees.map((m) => `${m.emoji} ${m.name}`).join(', ')}
                  {!t.recurring && <span className="ml-2 text-amber-600">· một lần</span>}
                </p>
              </div>
              {isParent && (
                <>
                  <button onClick={() => openEdit(t.id)} className="text-gray-300 hover:text-violet-500 text-sm" title="Sửa">✏️</button>
                  <button onClick={() => removeTodo(t.id)} className="text-gray-300 hover:text-red-400 text-sm" title="Xóa">🗑</button>
                </>
              )}
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
