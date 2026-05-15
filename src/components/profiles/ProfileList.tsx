import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../../store/useStore'
import { calcAge } from '../../utils/helpers'
import { compressImage } from '../../utils/image'
import { ROLE_CONFIG, isParentRole } from '../../types'
import type { MemberRole } from '../../types'

const COLORS = ['bg-blue-500', 'bg-rose-500', 'bg-amber-500', 'bg-emerald-500', 'bg-violet-500', 'bg-pink-500', 'bg-teal-500', 'bg-orange-500', 'bg-cyan-500']
const EMOJIS = ['👨', '👩', '🧒', '👦', '👧', '🧑', '👶', '👴', '👵', '🧔', '👱‍♀️']

type Props = { onSelect: (id: string) => void }

function MemberAvatar({ avatarUrl, emoji, color, size = 'lg' }: { avatarUrl?: string; emoji: string; color: string; size?: 'sm' | 'lg' }) {
  const sizeClass = size === 'lg' ? 'w-16 h-16 text-4xl rounded-2xl' : 'w-10 h-10 text-2xl rounded-xl'
  return (
    <div className={`${sizeClass} ${color} flex items-center justify-center shadow-md overflow-hidden flex-shrink-0`}>
      {avatarUrl
        ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
        : <span>{emoji}</span>}
    </div>
  )
}

export default function ProfileList({ onSelect }: Props) {
  const members       = useStore((s) => s.members)
  const addMember     = useStore((s) => s.addMember)
  const removeMember  = useStore((s) => s.removeMember)
  const currentMemberId = useStore((s) => s.currentMemberId)

  const currentMember = members.find((m) => m.id === currentMemberId)
  const isParent = currentMember ? isParentRole(currentMember.role) : false

  const [showAdd, setShowAdd]         = useState(false)
  const [deleteId, setDeleteId]       = useState<string | null>(null)
  const [submitting, setSubmitting]   = useState(false)
  const [toast, setToast]             = useState('')
  const photoRef                      = useRef<HTMLInputElement>(null)
  const [form, setForm]               = useState({
    name: '', role: 'child' as MemberRole, emoji: '🧒', color: 'bg-amber-500', birthday: '', bloodType: '', avatarUrl: '',
  })

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      // Avatar: max 512 px is enough for a profile picture, 80% quality
      const dataUrl = await compressImage(file, { maxPx: 512, quality: 0.80 })
      setForm((f) => ({ ...f, avatarUrl: dataUrl }))
    } catch (err: any) {
      showToast(`❌ ${err?.message ?? 'Không thể xử lý ảnh'}`)
    }
  }

  const submit = () => {
    if (!form.name.trim() || submitting) return
    setSubmitting(true)
    addMember({
      name: form.name.trim(), role: form.role, emoji: form.emoji, color: form.color,
      birthday: form.birthday, bloodType: form.bloodType,
      favoriteFoods: [], allergies: [], goals: [],
      avatarUrl: form.avatarUrl || undefined,
    })
    setShowAdd(false)
    setForm({ name: '', role: 'child', emoji: '🧒', color: 'bg-amber-500', birthday: '', bloodType: '', avatarUrl: '' })
    setSubmitting(false)
    showToast(`✅ Đã thêm "${form.name.trim()}" vào gia đình!`)
  }

  const confirmDelete = (id: string) => {
    removeMember(id)
    setDeleteId(null)
  }

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-800 text-white px-5 py-3 rounded-2xl shadow-xl text-sm font-medium animate-bounce">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">👨‍👩‍👧 Thành viên gia đình</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">{members.length} thành viên</p>
        </div>
        {isParent && (
          <button onClick={() => setShowAdd(true)}
            className="bg-violet-600 text-white px-4 py-2 rounded-xl font-medium text-sm hover:bg-violet-700">
            + Thêm thành viên
          </button>
        )}
      </div>

      {/* Add form */}
      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-md border border-gray-100 dark:border-gray-700 mb-5"
          >
            <h3 className="font-bold text-gray-700 dark:text-white mb-4">Thêm thành viên mới</h3>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Tên</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="VD: An, Bình, Ông Hùng..." className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl p-2.5 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Vai trò</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as MemberRole })}
                  className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl p-2.5 text-sm">
                  {(Object.entries(ROLE_CONFIG) as [MemberRole, typeof ROLE_CONFIG[MemberRole]][]).map(([key, cfg]) => (
                    <option key={key} value={key}>{cfg.emoji} {cfg.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Ngày sinh</label>
                <input type="date" value={form.birthday} onChange={(e) => setForm({ ...form, birthday: e.target.value })}
                  className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl p-2.5 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Nhóm máu</label>
                <select value={form.bloodType} onChange={(e) => setForm({ ...form, bloodType: e.target.value })}
                  className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl p-2.5 text-sm">
                  <option value="">—</option>
                  {['A+','A-','B+','B-','O+','O-','AB+','AB-'].map((bt) => <option key={bt} value={bt}>{bt}</option>)}
                </select>
              </div>
            </div>
            <div className="mb-3">
              <label className="text-xs text-gray-500 dark:text-gray-400 block mb-2">Ảnh đại diện</label>
              <input ref={photoRef} type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
              <div className="flex items-center gap-3">
                {form.avatarUrl
                  ? <img src={form.avatarUrl} alt="" className="w-12 h-12 rounded-xl object-cover border border-gray-200" />
                  : <div className={`w-12 h-12 rounded-xl ${form.color} flex items-center justify-center text-2xl`}>{form.emoji}</div>}
                <button type="button" onClick={() => photoRef.current?.click()}
                  className="text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 px-3 py-1.5 rounded-xl font-medium">
                  📷 Chọn ảnh
                </button>
                {form.avatarUrl && (
                  <button type="button" onClick={() => setForm((f) => ({ ...f, avatarUrl: '' }))}
                    className="text-xs text-red-400 hover:text-red-600">Xóa</button>
                )}
              </div>
            </div>
            <div className="mb-3">
              <label className="text-xs text-gray-500 dark:text-gray-400 block mb-2">Avatar emoji</label>
              <div className="flex gap-2 flex-wrap">
                {EMOJIS.map((e) => (
                  <button key={e} onClick={() => setForm({ ...form, emoji: e })}
                    className={`text-2xl p-2 rounded-xl transition-all ${form.emoji === e ? 'bg-violet-100 ring-2 ring-violet-400' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-4">
              <label className="text-xs text-gray-500 dark:text-gray-400 block mb-2">Màu sắc</label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map((c) => (
                  <button key={c} onClick={() => setForm({ ...form, color: c })}
                    className={`w-8 h-8 rounded-full ${c} border-4 transition-all ${form.color === c ? 'border-violet-500 scale-110' : 'border-white dark:border-gray-800'}`} />
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={submit} disabled={submitting || !form.name.trim()}
                className="bg-violet-600 text-white px-4 py-2 rounded-xl font-medium text-sm hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed">
                {submitting ? '...' : 'Thêm thành viên'}
              </button>
              <button onClick={() => setShowAdd(false)} className="text-gray-500 dark:text-gray-400 px-4 py-2 rounded-xl text-sm hover:bg-gray-100 dark:hover:bg-gray-700">Hủy</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Member cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {members.map((m, i) => (
          <motion.div key={m.id} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: i * 0.07 }}
            className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow group relative"
          >
            <div className="flex items-center gap-4 cursor-pointer" onClick={() => onSelect(m.id)}>
              {/* Avatar — shows photo if available, else emoji */}
              <div className={`w-16 h-16 rounded-2xl ${m.color} flex items-center justify-center text-4xl shadow-md group-hover:scale-105 transition-transform overflow-hidden flex-shrink-0`}>
                {m.avatarUrl
                  ? <img src={m.avatarUrl} alt={m.name} className="w-full h-full object-cover" />
                  : <span>{m.emoji}</span>}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-gray-800 dark:text-white text-lg truncate">{m.name}</h3>
                  {m.id === currentMemberId && (
                    <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full flex-shrink-0">Bạn</span>
                  )}
                </div>
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  {ROLE_CONFIG[m.role]?.emoji} {ROLE_CONFIG[m.role]?.label ?? m.role}
                  {m.birthday ? ` · ${calcAge(m.birthday)} tuổi` : ''}
                </p>
                {m.role === 'child' && (
                  <p className="text-amber-600 font-semibold text-sm mt-1">🪙 {m.tokens} xu</p>
                )}
                {m.bloodType && <p className="text-xs text-gray-400">🩸 {m.bloodType}</p>}
              </div>
              <span className="text-gray-300 group-hover:text-gray-500 dark:text-gray-600 dark:group-hover:text-gray-400 transition-colors flex-shrink-0">→</span>
            </div>

            {m.goals?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {m.goals.slice(0, 2).map((g, j) => (
                  <span key={j} className="text-xs bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-300 px-2 py-0.5 rounded-full">{g}</span>
                ))}
              </div>
            )}

            {/* Delete button (parent only, not self) */}
            {isParent && m.id !== currentMemberId && (
              <button
                onClick={(e) => { e.stopPropagation(); setDeleteId(m.id) }}
                className="absolute top-3 right-3 w-7 h-7 bg-red-100 hover:bg-red-500 text-red-400 hover:text-white rounded-full text-xs transition-all opacity-0 group-hover:opacity-100 flex items-center justify-center"
                title="Xóa thành viên"
              >
                ✕
              </button>
            )}
          </motion.div>
        ))}
      </div>

      {/* Delete confirmation modal */}
      <AnimatePresence>
        {deleteId && (() => {
          const target = members.find((m) => m.id === deleteId)
          return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={() => setDeleteId(null)}
            >
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white dark:bg-gray-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="text-center mb-4">
                  <div className={`w-16 h-16 rounded-2xl ${target?.color} flex items-center justify-center text-4xl mx-auto mb-3 overflow-hidden`}>
                    {target?.avatarUrl
                      ? <img src={target.avatarUrl} alt="" className="w-full h-full object-cover" />
                      : target?.emoji}
                  </div>
                  <h3 className="font-bold text-gray-800 dark:text-white text-lg">Xóa thành viên?</h3>
                  <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                    Bạn có chắc muốn xóa <strong>{target?.name}</strong>? Thao tác này không thể hoàn tác.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setDeleteId(null)}
                    className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-2.5 rounded-xl font-medium text-sm hover:bg-gray-200">
                    Hủy
                  </button>
                  <button onClick={() => confirmDelete(deleteId)}
                    className="flex-1 bg-red-500 text-white py-2.5 rounded-xl font-medium text-sm hover:bg-red-600">
                    Xóa
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )
        })()}
      </AnimatePresence>
    </div>
  )
}
