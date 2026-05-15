import { useState, useRef } from 'react'
import { useStore } from '../../store/useStore'
import { calcAge } from '../../utils/helpers'
import { compressImage } from '../../utils/image'
import { ROLE_CONFIG, isParentRole } from '../../types'
import HealthChart from './HealthChart'
import SkillTree from './SkillTree'
import type { Member } from '../../types'

const MEMBER_COLORS = ['bg-blue-500', 'bg-rose-500', 'bg-amber-500', 'bg-emerald-500', 'bg-violet-500', 'bg-pink-500', 'bg-teal-500', 'bg-orange-500', 'bg-cyan-500']
const MEMBER_EMOJIS = ['👨', '👩', '🧒', '👦', '👧', '🧑', '👶', '👴', '👵', '🧔', '👱‍♀️']
const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']

type Props = { memberId: string; onBack: () => void }
type Tab = 'info' | 'health' | 'skills' | 'photos'

export default function ProfilePage({ memberId, onBack }: Props) {
  const members       = useStore((s) => s.members)
  const updateMember  = useStore((s) => s.updateMember)
  const removeMember  = useStore((s) => s.removeMember)
  const photos        = useStore((s) => s.photos)
  const currentMemberId = useStore((s) => s.currentMemberId)

  const [editing, setEditing]     = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [form, setForm]           = useState<Partial<Member>>({})
  const [newFood, setNewFood]     = useState('')
  const [newAllergy, setNewAllergy] = useState('')
  const [newGoal, setNewGoal]     = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('info')
  const avatarFileRef = useRef<HTMLInputElement>(null)

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

  const currentMember = members.find((m) => m.id === currentMemberId)
  const canEdit = currentMemberId === memberId || (currentMember ? isParentRole(currentMember.role) : false)
  const isParent = currentMember ? isParentRole(currentMember.role) : false
  const isChild = member.role === 'child'
  const taggedPhotos = photos.filter((p) => p.taggedMembers.includes(memberId))
  const displayForm = editing ? { ...member, ...form } : member

  const startEdit = () => { setForm({ ...member }); setEditing(true) }
  const save = () => { updateMember(memberId, form); setEditing(false) }
  const cancelEdit = () => { setEditing(false); setForm({}) }

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const dataUrl = await compressImage(file, { maxPx: 512, quality: 0.80 })
      setForm((f) => ({ ...f, avatarUrl: dataUrl }))
    } catch (err: any) {
      alert(err?.message ?? 'Không thể xử lý ảnh, thử lại!')
    }
  }

  const handleDelete = () => {
    removeMember(memberId)
    onBack()
  }

  const roleLabel = ROLE_CONFIG[member.role]?.label ?? member.role
  const roleEmoji = ROLE_CONFIG[member.role]?.emoji ?? '🧑'

  const tabs: { key: Tab; label: string }[] = [
    { key: 'info',   label: '📋 Thông tin' },
    { key: 'health', label: '📊 Sức khỏe' },
    ...(isChild ? [{ key: 'skills' as Tab, label: '🌳 Kỹ năng' }] : []),
    { key: 'photos', label: '📸 Ảnh' },
  ]

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 text-sm font-medium">
          ← Quay lại
        </button>
        {/* Delete button (parent only, not self) */}
        {isParent && memberId !== currentMemberId && (
          <button onClick={() => setShowDelete(true)}
            className="text-sm text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-1.5 rounded-xl transition-all">
            🗑️ Xóa thành viên
          </button>
        )}
      </div>

      {/* Profile header */}
      <div className="bg-gradient-to-br from-violet-500 to-indigo-600 rounded-3xl p-6 text-white mb-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 text-9xl opacity-10 pointer-events-none select-none">🏠</div>

        <div className="flex items-start gap-4 flex-wrap">
          {editing ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-16 h-16 rounded-full ${form.color ?? member.color} flex items-center justify-center text-3xl shadow border-2 border-white/30 overflow-hidden flex-shrink-0`}>
                  {(form.avatarUrl ?? member.avatarUrl)
                    ? <img src={form.avatarUrl ?? member.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                    : <span>{form.emoji ?? member.emoji}</span>}
                </div>
                <div className="flex flex-col gap-1">
                  <input ref={avatarFileRef} type="file" accept="image/*" onChange={handleAvatarFile} className="hidden" />
                  <button onClick={() => avatarFileRef.current?.click()}
                    className="bg-white/20 hover:bg-white/30 text-white text-xs px-3 py-1.5 rounded-xl font-medium">
                    📷 Đổi ảnh
                  </button>
                  {(form.avatarUrl ?? member.avatarUrl) && (
                    <button onClick={() => setForm((f) => ({ ...f, avatarUrl: '' }))}
                      className="bg-red-400/40 hover:bg-red-400/60 text-white text-xs px-3 py-1 rounded-xl">
                      ✕ Xóa ảnh
                    </button>
                  )}
                </div>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {MEMBER_EMOJIS.map((e) => (
                  <button key={e} onClick={() => setForm((f) => ({ ...f, emoji: e }))}
                    className={`text-2xl p-1.5 rounded-xl transition-all ${(form.emoji ?? member.emoji) === e ? 'bg-white/30 scale-110' : 'hover:bg-white/20'}`}>
                    {e}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Display mode avatar — shows photo OR emoji */
            <div className={`w-20 h-20 rounded-full ${member.color} flex items-center justify-center text-5xl shadow-lg border-4 border-white/30 flex-shrink-0 overflow-hidden`}>
              {member.avatarUrl
                ? <img src={member.avatarUrl} alt={member.name} className="w-full h-full object-cover" />
                : <span>{member.emoji}</span>}
            </div>
          )}

          <div className="flex-1 min-w-0">
            {editing ? (
              <input
                value={form.name ?? member.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="bg-white/20 border border-white/30 rounded-xl px-3 py-1.5 text-white placeholder-white/50 text-xl font-bold w-full mb-2"
                placeholder="Tên thành viên"
              />
            ) : (
              <h2 className="text-3xl font-bold">{member.name}</h2>
            )}

            {editing ? (
              <select value={form.role ?? member.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Member['role'] }))}
                className="bg-white/20 border border-white/30 rounded-xl px-3 py-1.5 text-white text-sm mt-1 w-full">
                {(Object.entries(ROLE_CONFIG) as [Member['role'], typeof ROLE_CONFIG[Member['role']]][]).map(([key, cfg]) => (
                  <option key={key} value={key} className="text-gray-800">{cfg.emoji} {cfg.label}</option>
                ))}
              </select>
            ) : (
              <p className="text-violet-200">
                {roleEmoji} {roleLabel}
                {member.birthday ? ` · ${calcAge(member.birthday)} tuổi` : ''}
              </p>
            )}

            {isChild && (
              <span className="inline-block mt-2 bg-white/20 px-3 py-1 rounded-full text-sm font-bold">
                🪙 {member.tokens} xu
              </span>
            )}
          </div>
        </div>

        {editing && (
          <div className="flex gap-2 flex-wrap mt-4">
            {MEMBER_COLORS.map((c) => (
              <button key={c} onClick={() => setForm((f) => ({ ...f, color: c }))}
                className={`w-8 h-8 rounded-full ${c} border-4 transition-all ${(form.color ?? member.color) === c ? 'border-white scale-110' : 'border-transparent'}`}
              />
            ))}
          </div>
        )}

        {/* Edit / Save buttons */}
        {canEdit && (
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
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {tabs.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === tab.key ? 'bg-violet-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">

        {/* INFO TAB */}
        {activeTab === 'info' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-400 uppercase font-medium block mb-1">Ngày sinh</label>
                {editing ? (
                  <input type="date" value={form.birthday ?? member.birthday}
                    onChange={(e) => setForm((f) => ({ ...f, birthday: e.target.value }))}
                    className="border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl p-2 text-sm w-full" />
                ) : (
                  <p className="font-medium text-gray-800 dark:text-white">{member.birthday || '—'}</p>
                )}
              </div>
              <div>
                <label className="text-xs text-gray-400 uppercase font-medium block mb-1">Nhóm máu</label>
                {editing ? (
                  <select value={form.bloodType ?? member.bloodType}
                    onChange={(e) => setForm((f) => ({ ...f, bloodType: e.target.value }))}
                    className="border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl p-2 text-sm w-full">
                    <option value="">—</option>
                    {BLOOD_TYPES.map((bt) => <option key={bt} value={bt}>{bt}</option>)}
                  </select>
                ) : (
                  <p className="font-medium text-gray-800 dark:text-white">{member.bloodType || '—'}</p>
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
                      <button onClick={() => setForm((prev) => ({ ...prev, favoriteFoods: (prev.favoriteFoods ?? member.favoriteFoods).filter((_, j) => j !== i) }))}
                        className="text-orange-400 hover:text-red-500 ml-1">✕</button>
                    )}
                  </span>
                ))}
                {editing && (
                  <div className="flex gap-2">
                    <input value={newFood} onChange={(e) => setNewFood(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && newFood.trim()) { setForm((f) => ({ ...f, favoriteFoods: [...(f.favoriteFoods ?? member.favoriteFoods), newFood.trim()] })); setNewFood('') } }}
                      placeholder="Thêm món..." className="border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl px-3 py-1 text-sm w-28" />
                    <button onClick={() => { if (newFood.trim()) { setForm((f) => ({ ...f, favoriteFoods: [...(f.favoriteFoods ?? member.favoriteFoods), newFood.trim()] })); setNewFood('') } }}
                      className="bg-orange-500 text-white px-2 py-1 rounded-xl text-sm">+</button>
                  </div>
                )}
                {member.favoriteFoods.length === 0 && !editing && <p className="text-gray-400 text-sm">Chưa có</p>}
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
                      <button onClick={() => setForm((prev) => ({ ...prev, allergies: (prev.allergies ?? member.allergies).filter((_, j) => j !== i) }))}
                        className="text-red-400 hover:text-red-600 ml-1">✕</button>
                    )}
                  </span>
                ))}
                {editing && (
                  <div className="flex gap-2">
                    <input value={newAllergy} onChange={(e) => setNewAllergy(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && newAllergy.trim()) { setForm((f) => ({ ...f, allergies: [...(f.allergies ?? member.allergies), newAllergy.trim()] })); setNewAllergy('') } }}
                      placeholder="Thêm dị ứng..." className="border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl px-3 py-1 text-sm w-32" />
                    <button onClick={() => { if (newAllergy.trim()) { setForm((f) => ({ ...f, allergies: [...(f.allergies ?? member.allergies), newAllergy.trim()] })); setNewAllergy('') } }}
                      className="bg-red-500 text-white px-2 py-1 rounded-xl text-sm">+</button>
                  </div>
                )}
                {member.allergies.length === 0 && !editing && <p className="text-gray-400 text-sm">Không có</p>}
              </div>
            </div>

            {/* Goals */}
            <div>
              <label className="text-xs text-gray-400 uppercase font-medium block mb-2">🎯 Mục tiêu cá nhân</label>
              <div className="space-y-2">
                {(editing ? (form.goals ?? member.goals) : member.goals).map((g, i) => (
                  <div key={i} className="flex items-center gap-2 bg-violet-50 dark:bg-violet-900/20 rounded-xl px-3 py-2">
                    <span className="text-violet-400">✦</span>
                    <span className="flex-1 text-sm text-gray-700 dark:text-gray-200">{g}</span>
                    {editing && (
                      <button onClick={() => setForm((prev) => ({ ...prev, goals: (prev.goals ?? member.goals).filter((_, j) => j !== i) }))}
                        className="text-gray-300 hover:text-red-400">✕</button>
                    )}
                  </div>
                ))}
                {editing && (
                  <div className="flex gap-2">
                    <input value={newGoal} onChange={(e) => setNewGoal(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && newGoal.trim()) { setForm((f) => ({ ...f, goals: [...(f.goals ?? member.goals), newGoal.trim()] })); setNewGoal('') } }}
                      placeholder="Thêm mục tiêu..." className="flex-1 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl px-3 py-2 text-sm" />
                    <button onClick={() => { if (newGoal.trim()) { setForm((f) => ({ ...f, goals: [...(f.goals ?? member.goals), newGoal.trim()] })); setNewGoal('') } }}
                      className="bg-violet-600 text-white px-3 py-2 rounded-xl text-sm font-medium">+</button>
                  </div>
                )}
                {member.goals.length === 0 && !editing && <p className="text-gray-400 text-sm">Chưa có mục tiêu nào</p>}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'health' && <HealthChart memberId={memberId} />}
        {activeTab === 'skills' && isChild && <SkillTree memberId={memberId} />}

        {activeTab === 'photos' && (
          <div>
            <h3 className="font-bold text-gray-700 dark:text-white mb-4">📸 Ảnh có mặt {member.name}</h3>
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

      {/* Delete confirmation modal */}
      {showDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowDelete(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-center mb-4">
              <p className="text-4xl mb-2">⚠️</p>
              <h3 className="font-bold text-gray-800 dark:text-white text-lg">Xóa thành viên?</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                Bạn có chắc muốn xóa <strong>{member.name}</strong>? Tất cả dữ liệu sức khỏe và kỹ năng của thành viên này sẽ bị mất.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowDelete(false)}
                className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-2.5 rounded-xl font-medium text-sm">Hủy</button>
              <button onClick={handleDelete}
                className="flex-1 bg-red-500 text-white py-2.5 rounded-xl font-medium text-sm hover:bg-red-600">Xóa</button>
            </div>
          </div>
        </div>
      )}

      {/* Unused variable suppression */}
      {void displayForm}
    </div>
  )
}
