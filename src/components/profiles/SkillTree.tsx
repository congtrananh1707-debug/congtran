import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useStore } from '../../store/useStore'
import { SKILL_CATEGORIES } from '../../types'
import type { SkillCategory } from '../../types'

type Props = { memberId: string }

const SKILL_ICONS = ['📖', '✍️', '🔢', '🏃', '⚽', '🏊', '🎨', '🎵', '🤝', '💬', '🌱', '🎯', '🧩', '🚲', '🍳']

export default function SkillTree({ memberId }: Props) {
  // Lấy stable reference rồi filter bằng useMemo — tránh infinite re-render
  const allSkills  = useStore((s) => s.skills)
  const addSkill   = useStore((s) => s.addSkill)
  const toggleSkill= useStore((s) => s.toggleSkill)
  const removeSkill= useStore((s) => s.removeSkill)

  const skills = useMemo(() => allSkills.filter((sk) => sk.memberId === memberId), [allSkills, memberId])

  const [activeCategory, setActiveCategory] = useState<SkillCategory>('academics')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', icon: '🎯' })

  const catSkills    = useMemo(() => skills.filter((sk) => sk.category === activeCategory), [skills, activeCategory])
  const totalAchieved = useMemo(() => skills.filter((sk) => sk.achieved).length, [skills])

  const submit = () => {
    if (!form.name.trim()) return
    addSkill(memberId, activeCategory, form.name.trim(), form.icon)
    setForm({ name: '', icon: '🎯' })
    setShowAdd(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2">
          🌳 Cây kỹ năng
          <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
            {totalAchieved}/{skills.length} đạt được
          </span>
        </h3>
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {SKILL_CATEGORIES.map((cat) => {
          const count = skills.filter((sk) => sk.category === cat.key && sk.achieved).length
          const total = skills.filter((sk) => sk.category === cat.key).length
          return (
            <button key={cat.key} onClick={() => setActiveCategory(cat.key)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
                activeCategory === cat.key ? 'bg-violet-600 text-white shadow-md' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
              }`}>
              {cat.icon} {cat.label}
              {total > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeCategory === cat.key ? 'bg-white/20' : 'bg-gray-200 dark:bg-gray-600'}`}>
                  {count}/{total}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Tree visual */}
      <div className="bg-gradient-to-b from-sky-50 to-green-50 rounded-3xl p-5 min-h-40 relative border border-green-100">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-16 bg-amber-700 rounded-t-full opacity-60" />

        {catSkills.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p className="text-3xl mb-2">🌱</p>
            <p className="text-sm">Chưa có kỹ năng nào. Thêm ngay!</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3 justify-center pb-8">
            {catSkills.map((sk, i) => (
              <motion.div key={sk.id} initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: i * 0.05, type: 'spring', stiffness: 300 }}
                className="relative group">
                <button onClick={() => toggleSkill(sk.id)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-2xl w-24 transition-all hover:scale-105 border-2 ${
                    sk.achieved ? 'bg-emerald-400 border-emerald-500 text-white shadow-lg shadow-emerald-200' : 'bg-white border-gray-200 text-gray-500 opacity-70'
                  }`}>
                  <span className={`text-2xl ${sk.achieved ? 'animate-bounce-in' : 'grayscale'}`}>{sk.icon}</span>
                  <span className="text-xs font-medium text-center leading-tight">{sk.name}</span>
                  {sk.achieved && <span className="text-xs">✅</span>}
                  {sk.achievedDate && <span className="text-xs opacity-70">{sk.achievedDate.slice(5)}</span>}
                </button>
                <button onClick={() => removeSkill(sk.id)}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-red-400 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  ✕
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Add skill */}
      <div className="mt-3">
        {showAdd ? (
          <div className="bg-gray-50 dark:bg-gray-700 rounded-2xl p-3 flex gap-2 items-end flex-wrap">
            <div className="flex-1 min-w-32">
              <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Tên kỹ năng</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="VD: Biết bơi..."
                className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-600 dark:text-white rounded-xl p-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Icon</label>
              <select value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })}
                className="border border-gray-200 dark:border-gray-600 dark:bg-gray-600 dark:text-white rounded-xl p-2 text-sm">
                {SKILL_ICONS.map((ic) => <option key={ic} value={ic}>{ic}</option>)}
              </select>
            </div>
            <button onClick={submit} className="bg-violet-600 text-white px-3 py-2 rounded-xl text-sm font-medium">Thêm</button>
            <button onClick={() => setShowAdd(false)} className="text-gray-400 px-3 py-2 rounded-xl text-sm hover:bg-gray-100 dark:hover:bg-gray-600">Hủy</button>
          </div>
        ) : (
          <button onClick={() => setShowAdd(true)} className="text-sm text-violet-600 hover:text-violet-800 font-medium">
            + Thêm kỹ năng mới
          </button>
        )}
      </div>
    </div>
  )
}
