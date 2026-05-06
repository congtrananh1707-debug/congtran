import { useState } from 'react'
import { useStore } from '../../store/useStore'
import { calcAge } from '../../utils/helpers'
import HealthChart from './HealthChart'
import SkillTree from './SkillTree'
import type { Member } from '../../types'

const MEMBER_COLORS = ['bg-blue-500', 'bg-rose-500', 'bg-amber-500', 'bg-emerald-500', 'bg-violet-500', 'bg-pink-500', 'bg-teal-500']
const MEMBER_EMOJIS = ['👨', '👩', '🧒', '👦', '👧', '🧑', '👶']
const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']

type Props = { memberId: string; onBack: () => void }
type Tab = 'info' | 'health' | 'skills' | 'photos'

export default function ProfilePage({ memberId, onBack }: Props) {
  // ── Tất cả hooks phải gọi trước bất kỳ return nào ─────────────────────────
  const members = useStore((s) => s.members)
  const updateMember = useStore((s) => s.updateMember)
  const photos = useStore((s) => s.photos)

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Partial<Member>>({})
  const [newFood, setNewFood] = useState('')
  const [newAllergy, setNewAllergy] = useState('')
  const [newGoal, setNewGoal] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('info')

  // ── Sau hooks mới được phép check conditional ──────────────────────────────
  const member = members.find((m) => m.id === memberId)

  if (!member) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400 p-8">
        <p className="text-4xl mb-3">🔍</p>
        <p>Không tìm thấy thành viên.</p>
        <button onClick={onBack} className="mt-4 text-violet-600 hover:underline text-sm">← Quay lại</button>
      </div>
    )
  }

  const isChild = member.role === 'child'
  const taggedPhotos = photos.filter((p) => p.taggedMembers.includes(memberId))

  const displayForm = editing ? { ...member, ...form } : member

  const startEdit = () => { setForm({ ...member }); setEditing(true) }
  const save = () => { updateMember(memberId, form); setEditing(false) }
  const cancelEdit = () => { setEditing(false); setForm({}) }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'info', label: '📋 Thông tin' },
    { key: 'health', label: '📊 Sức khỏe' },
    ...(isChild ? [{ key: 'skills' as Tab, label: '🌳 Kỹ năng' }] : []),
    { key: 'photos', label: '📸 Ảnh' },
  ]

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-5 text-sm font-medium">
        ← Quay lại
      </button>

      {/* ── Profile header ─────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-violet-500 to-indigo-600 rounded-3xl p-6 text-white mb-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 text-9xl opacity-10 pointer-events-none select-none">🏠</div>

        <div className="flex items-start gap-4 flex-wrap">
          {/* Avatar / emoji picker */}
          {editing ? (
            <div className="flex gap-2 flex-wrap max-w-xs">
              {MEMBER_EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => setForm((f) => ({ ...f, emoji: e }))}
                  className={`text-3xl p-1.5 rounded-xl transition-all ${form.emoji === e ? 'bg-white/30 scale-110' : 'hover:bg-white/20'}`}
                >
                  {e}
                </button>
              ))}
            </div>
          ) : (
            <div className={`w-20 h-20 rounded-full ${member.color} flex items-center justify-center text-5xl shadow-lg border-4 border-white/30 flex-shrink-0`}>
              {member.emoji}
            </div>
          )}

          {/* Name & role */}
          <div className="flex-1 min-w-0">
            {editing ? (
              <input
                value={form.name ?? member.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="bg-white/20 border border-white/30 rounded-xl px-3 py-1.5 text-white placeholder-white/50 text-xl font-bold w-full mb-2"
                placeholder="Tên thành viên"
              />
            ) : (
              <h2 className="text-3xl font-bold">{member.emoji} {member.name}</h2>
            )}
            <p className="text-violet-200">
              {member.role === 'dad' ? '👨 Bố' : member.role === 'mom' ? '👩 Mẹ' : '🧒 Con'}
              {member.birthday ? ` · ${calcAge(member.birthday)} tuổi` : ''}
            </p>
            {isChild && (
              <span className="inline-block mt-2 bg-white/20 px-3 py-1 rounded-full text-sm font-bold">
                🪙 {member.tokens} xu
              </span>
            )}
          </div>
        </div>

        {/* Color picker (edit mode) */}
        {editing && (
          <div className="flex gap-2 flex-wrap mt-4">
            {MEMBER_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setForm((f) => ({ ...f, color: c }))}
                className={`w-8 h-8 rounded-full ${c} border-4 transition-all ${(form.color ?? member.color) === c ? 'border-white scale-110' : 'border-transparent'}`}
              />
            ))}
          </div>
        )}

        {/* Edit / Save buttons */}
        <div className="absolute top-4 right-4 flex gap-2">
          {editing ? (
            <>
              <button onClick={save} className="bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-xl text-sm font-medium">
                💾 Lưu
              </button>
              <button onClick={cancelEdit} className="bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-xl text-sm">
                Hủy
              </button>
            </>
          ) : (
            <button onClick={startEdit} className="bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-xl text-sm font-medium">
              ✏️ Sửa
            </button>
          )}
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === tab.key ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">

        {/* INFO TAB */}
        {activeTab === 'info' && (
          <div className="space-y-5">
            {/* Birthday & blood type */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-400 uppercase font-medium block mb-1">Ngày sinh</label>
                {editing ? (
                  <input
                    type="date"
                    value={form.birthday ?? member.birthday}
                    onChange={(e) => setForm((f) => ({ ...f, birthday: e.target.value }))}
                    className="border border-gray-200 rounded-xl p-2 text-sm w-full"
                  />
                ) : (
                  <p className="font-medium text-gray-800">{member.birthday || '—'}</p>
                )}
              </div>
              <div>
                <label className="text-xs text-gray-400 uppercase font-medium block mb-1">Nhóm máu</label>
                {editing ? (
                  <select
                    value={form.bloodType ?? member.bloodType}
                    onChange={(e) => setForm((f) => ({ ...f, bloodType: e.target.value }))}
                    className="border border-gray-200 rounded-xl p-2 text-sm w-full"
                  >
                    <option value="">—</option>
                    {BLOOD_TYPES.map((bt) => <option key={bt} value={bt}>{bt}</option>)}
                  </select>
                ) : (
                  <p className="font-medium text-gray-800">{member.bloodType || '—'}</p>
                )}
              </div>
            </div>

            {/* Favorite foods */}
            <div>
              <label className="text-xs text-gray-400 uppercase font-medium block mb-2">🍜 Món ăn yêu thích</label>
              <div className="flex flex-wrap gap-2">
                {(editing ? (form.favoriteFoods ?? member.favoriteFoods) : member.favoriteFoods).map((f, i) => (
                  <span key={i} className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-sm flex items-center gap-1">
                    {f}
                    {editing && (
                      <button
                        onClick={() => setForm((prev) => ({ ...prev, favoriteFoods: (prev.favoriteFoods ?? member.favoriteFoods).filter((_, j) => j !== i) }))}
                        className="text-orange-400 hover:text-red-500 ml-1 leading-none"
                      >
                        ✕
                      </button>
                    )}
                  </span>
                ))}
                {editing && (
                  <div className="flex gap-2">
                    <input
                      value={newFood}
                      onChange={(e) => setNewFood(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newFood.trim()) {
                          setForm((f) => ({ ...f, favoriteFoods: [...(f.favoriteFoods ?? member.favoriteFoods), newFood.trim()] }))
                          setNewFood('')
                        }
                      }}
                      placeholder="Thêm món..."
                      className="border border-gray-200 rounded-xl px-3 py-1 text-sm w-28"
                    />
                    <button
                      onClick={() => {
                        if (newFood.trim()) {
                          setForm((f) => ({ ...f, favoriteFoods: [...(f.favoriteFoods ?? member.favoriteFoods), newFood.trim()] }))
                          setNewFood('')
                        }
                      }}
                      className="bg-orange-500 text-white px-2 py-1 rounded-xl text-sm"
                    >
                      +
                    </button>
                  </div>
                )}
                {member.favoriteFoods.length === 0 && !editing && (
                  <p className="text-gray-400 text-sm">Chưa có</p>
                )}
              </div>
            </div>

            {/* Allergies */}
            <div>
              <label className="text-xs text-gray-400 uppercase font-medium block mb-2">⚠️ Dị ứng</label>
              <div className="flex flex-wrap gap-2">
                {(editing ? (form.allergies ?? member.allergies) : member.allergies).map((a, i) => (
                  <span key={i} className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm flex items-center gap-1">
                    {a}
                    {editing && (
                      <button
                        onClick={() => setForm((prev) => ({ ...prev, allergies: (prev.allergies ?? member.allergies).filter((_, j) => j !== i) }))}
                        className="text-red-400 hover:text-red-600 ml-1 leading-none"
                      >
                        ✕
                      </button>
                    )}
                  </span>
                ))}
                {editing && (
                  <div className="flex gap-2">
                    <input
                      value={newAllergy}
                      onChange={(e) => setNewAllergy(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newAllergy.trim()) {
                          setForm((f) => ({ ...f, allergies: [...(f.allergies ?? member.allergies), newAllergy.trim()] }))
                          setNewAllergy('')
                        }
                      }}
                      placeholder="Thêm dị ứng..."
                      className="border border-gray-200 rounded-xl px-3 py-1 text-sm w-32"
                    />
                    <button
                      onClick={() => {
                        if (newAllergy.trim()) {
                          setForm((f) => ({ ...f, allergies: [...(f.allergies ?? member.allergies), newAllergy.trim()] }))
                          setNewAllergy('')
                        }
                      }}
                      className="bg-red-500 text-white px-2 py-1 rounded-xl text-sm"
                    >
                      +
                    </button>
                  </div>
                )}
                {member.allergies.length === 0 && !editing && (
                  <p className="text-gray-400 text-sm">Không có</p>
                )}
              </div>
            </div>

            {/* Goals */}
            <div>
              <label className="text-xs text-gray-400 uppercase font-medium block mb-2">🎯 Mục tiêu cá nhân</label>
              <div className="space-y-2">
                {(editing ? (form.goals ?? member.goals) : member.goals).map((g, i) => (
                  <div key={i} className="flex items-center gap-2 bg-violet-50 rounded-xl px-3 py-2">
                    <span className="text-violet-400">✦</span>
                    <span className="flex-1 text-sm text-gray-700">{g}</span>
                    {editing && (
                      <button
                        onClick={() => setForm((prev) => ({ ...prev, goals: (prev.goals ?? member.goals).filter((_, j) => j !== i) }))}
                        className="text-gray-300 hover:text-red-400"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                {editing && (
                  <div className="flex gap-2">
                    <input
                      value={newGoal}
                      onChange={(e) => setNewGoal(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newGoal.trim()) {
                          setForm((f) => ({ ...f, goals: [...(f.goals ?? member.goals), newGoal.trim()] }))
                          setNewGoal('')
                        }
                      }}
                      placeholder="Thêm mục tiêu..."
                      className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm"
                    />
                    <button
                      onClick={() => {
                        if (newGoal.trim()) {
                          setForm((f) => ({ ...f, goals: [...(f.goals ?? member.goals), newGoal.trim()] }))
                          setNewGoal('')
                        }
                      }}
                      className="bg-violet-600 text-white px-3 py-2 rounded-xl text-sm font-medium"
                    >
                      +
                    </button>
                  </div>
                )}
                {member.goals.length === 0 && !editing && (
                  <p className="text-gray-400 text-sm">Chưa có mục tiêu nào</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* HEALTH TAB */}
        {activeTab === 'health' && <HealthChart memberId={memberId} />}

        {/* SKILLS TAB */}
        {activeTab === 'skills' && isChild && <SkillTree memberId={memberId} />}

        {/* PHOTOS TAB */}
        {activeTab === 'photos' && (
          <div>
            <h3 className="font-bold text-gray-700 mb-4">📸 Ảnh có mặt {member.name}</h3>
            {taggedPhotos.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <p className="text-4xl mb-2">📷</p>
                <p>Chưa có ảnh nào được tag {member.name}</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {taggedPhotos.map((p) => (
                  <div key={p.id} className="aspect-square rounded-2xl overflow-hidden">
                    <img src={p.dataUrl} alt={p.caption} className="w-full h-full object-cover hover:scale-105 transition-transform" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
