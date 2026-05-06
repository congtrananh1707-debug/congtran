import { useState } from 'react'
import { motion } from 'framer-motion'
import { useStore } from '../../store/useStore'
import { calcAge } from '../../utils/helpers'
import type { MemberRole } from '../../types'

const COLORS = ['bg-blue-500', 'bg-rose-500', 'bg-amber-500', 'bg-emerald-500', 'bg-violet-500', 'bg-pink-500', 'bg-teal-500']
const EMOJIS = ['👨', '👩', '🧒', '👦', '👧', '🧑', '👶']

type Props = { onSelect: (id: string) => void }

export default function ProfileList({ onSelect }: Props) {
  const members = useStore((s) => s.members)
  const addMember = useStore((s) => s.addMember)
  const removeMember = useStore((s) => s.removeMember)
  const currentMemberId = useStore((s) => s.currentMemberId)
  const currentMember = members.find((m) => m.id === currentMemberId)
  const isParent = currentMember?.role === 'dad' || currentMember?.role === 'mom'

  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', role: 'child' as MemberRole, emoji: '🧒', color: 'bg-amber-500', birthday: '', bloodType: '' })

  const submit = () => {
    if (!form.name.trim()) return
    addMember({ name: form.name.trim(), role: form.role, emoji: form.emoji, color: form.color, birthday: form.birthday, bloodType: form.bloodType, favoriteFoods: [], allergies: [], goals: [] })
    setShowAdd(false)
    setForm({ name: '', role: 'child', emoji: '🧒', color: 'bg-amber-500', birthday: '', bloodType: '' })
  }

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">👨‍👩‍👧 Thành viên gia đình</h1>
          <p className="text-gray-500 text-sm mt-0.5">{members.length} thành viên</p>
        </div>
        {isParent && (
          <button onClick={() => setShowAdd(true)} className="bg-violet-600 text-white px-4 py-2 rounded-xl font-medium text-sm hover:bg-violet-700">
            + Thêm thành viên
          </button>
        )}
      </div>

      {/* Add form */}
      {showAdd && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl p-5 shadow-md border border-gray-100 mb-5"
        >
          <h3 className="font-bold text-gray-700 mb-4">Thêm thành viên mới</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Tên</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="VD: An, Bình..." className="w-full border border-gray-200 rounded-xl p-2.5 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Vai trò</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as MemberRole })}
                className="w-full border border-gray-200 rounded-xl p-2.5 text-sm">
                <option value="child">Con</option>
                <option value="dad">Bố</option>
                <option value="mom">Mẹ</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Ngày sinh</label>
              <input type="date" value={form.birthday} onChange={(e) => setForm({ ...form, birthday: e.target.value })}
                className="w-full border border-gray-200 rounded-xl p-2.5 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Nhóm máu</label>
              <select value={form.bloodType} onChange={(e) => setForm({ ...form, bloodType: e.target.value })}
                className="w-full border border-gray-200 rounded-xl p-2.5 text-sm">
                <option value="">—</option>
                {['A+','A-','B+','B-','O+','O-','AB+','AB-'].map((bt) => <option key={bt} value={bt}>{bt}</option>)}
              </select>
            </div>
          </div>
          <div className="mb-3">
            <label className="text-xs text-gray-500 block mb-2">Avatar</label>
            <div className="flex gap-2 flex-wrap">
              {EMOJIS.map((e) => (
                <button key={e} onClick={() => setForm({ ...form, emoji: e })}
                  className={`text-2xl p-2 rounded-xl transition-all ${form.emoji === e ? 'bg-violet-100 ring-2 ring-violet-400' : 'hover:bg-gray-100'}`}>{e}</button>
              ))}
            </div>
          </div>
          <div className="mb-4">
            <label className="text-xs text-gray-500 block mb-2">Màu sắc</label>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button key={c} onClick={() => setForm({ ...form, color: c })}
                  className={`w-8 h-8 rounded-full ${c} border-4 transition-all ${form.color === c ? 'border-violet-500 scale-110' : 'border-white'}`} />
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={submit} className="bg-violet-600 text-white px-4 py-2 rounded-xl font-medium text-sm hover:bg-violet-700">Thêm</button>
            <button onClick={() => setShowAdd(false)} className="text-gray-500 px-4 py-2 rounded-xl text-sm hover:bg-gray-100">Hủy</button>
          </div>
        </motion.div>
      )}

      {/* Member cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {members.map((m, i) => (
          <motion.div key={m.id} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: i * 0.07 }}
            className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer group"
            onClick={() => onSelect(m.id)}
          >
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 rounded-2xl ${m.color} flex items-center justify-center text-4xl shadow-md group-hover:scale-105 transition-transform`}>
                {m.emoji}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-gray-800 text-lg">{m.name}</h3>
                  {m.id === currentMemberId && <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">Bạn</span>}
                </div>
                <p className="text-gray-500 text-sm">{m.role === 'dad' ? 'Bố' : m.role === 'mom' ? 'Mẹ' : 'Con'}{m.birthday ? ` · ${calcAge(m.birthday)} tuổi` : ''}</p>
                {m.role === 'child' && (
                  <p className="text-amber-600 font-semibold text-sm mt-1">🪙 {m.tokens} xu</p>
                )}
                {m.bloodType && <p className="text-xs text-gray-400">🩸 {m.bloodType}</p>}
              </div>
              <span className="text-gray-300 group-hover:text-gray-500 transition-colors">→</span>
            </div>
            {m.goals?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {m.goals.slice(0, 2).map((g, j) => (
                  <span key={j} className="text-xs bg-violet-50 text-violet-600 px-2 py-0.5 rounded-full">{g}</span>
                ))}
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  )
}
