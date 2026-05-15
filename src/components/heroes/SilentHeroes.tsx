import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../../store/useStore'

const REACTIONS = ['❤️', '🌟', '🤗', '👏', '🏆', '💪']
const BADGE_COLORS = ['text-amber-500', 'text-gray-400', 'text-amber-700']
const RANK_EMOJI = ['🥇', '🥈', '🥉']

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60000)
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (m < 1) return 'vừa xong'
  if (m < 60) return `${m} phút trước`
  if (h < 24) return `${h} giờ trước`
  return `${d} ngày trước`
}

export default function SilentHeroes() {
  const silentHeroes     = useStore((s) => s.silentHeroes)
  const addSilentHero    = useStore((s) => s.addSilentHero)
  const reactSilentHero  = useStore((s) => s.reactSilentHero)
  const removeSilentHero = useStore((s) => s.removeSilentHero)
  const members          = useStore((s) => s.members)
  const currentMemberId  = useStore((s) => s.currentMemberId)

  const me = members.find((m) => m.id === currentMemberId)
  const isParent = me?.role === 'dad' || me?.role === 'mom'

  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ memberId: members[0]?.id ?? '', deed: '' })

  // Monthly leaderboard
  const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0)
  const monthlyDeeds = members.map((m) => ({
    member: m,
    count: silentHeroes.filter((h) => h.memberId === m.id && h.timestamp >= startOfMonth.getTime()).length,
  })).sort((a, b) => b.count - a.count).filter((x) => x.count > 0)

  const [addDone, setAddDone] = useState(false)

  const submitDeed = () => {
    if (!form.deed.trim() || !form.memberId || addDone) return
    addSilentHero(form.memberId, currentMemberId || '', form.deed.trim())
    setAddDone(true)
    setTimeout(() => { setForm({ ...form, deed: '' }); setShowAdd(false); setAddDone(false) }, 600)
  }

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">🦸 Anh hùng thầm lặng</h1>
          <p className="text-gray-500 text-sm">Ghi nhận những việc tốt chưa được nhắc nhở</p>
        </div>
        {isParent && (
          <button onClick={() => setShowAdd(true)} className="bg-amber-500 text-white px-4 py-2 rounded-xl font-medium text-sm hover:bg-amber-600">
            + Ghi nhận
          </button>
        )}
      </div>

      {/* Monthly Leaderboard */}
      {monthlyDeeds.length > 0 && (
        <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          className="bg-gradient-to-br from-amber-400 to-orange-500 text-white rounded-3xl p-5 mb-5 shadow-lg">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-100 mb-3">🏆 Bảng vinh danh tháng này</p>
          <div className="space-y-2">
            {monthlyDeeds.slice(0, 5).map(({ member, count }, i) => (
              <motion.div key={member.id} initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: i * 0.1 }}
                className="flex items-center gap-3 bg-white/20 rounded-2xl px-4 py-2.5">
                <span className="text-2xl">{i < 3 ? RANK_EMOJI[i] : `${i + 1}.`}</span>
                <div className={`w-8 h-8 rounded-full ${member.color} flex items-center justify-center text-base`}>{member.emoji}</div>
                <span className="font-bold flex-1">{member.name}</span>
                <span className="text-amber-100 text-sm font-medium">{count} việc tốt</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {monthlyDeeds.length === 0 && !showAdd && (
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-3xl p-6 mb-5 text-center">
          <p className="text-4xl mb-2">🌱</p>
          <p className="text-amber-700 dark:text-amber-300 font-medium">Tháng này chưa có anh hùng nào được ghi nhận</p>
          {isParent && <p className="text-amber-600 dark:text-amber-400 text-sm mt-1">Nhấn "+ Ghi nhận" khi bạn thấy ai làm điều tốt!</p>}
        </div>
      )}

      {/* Add deed form */}
      <AnimatePresence>
        {showAdd && isParent && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 mb-5">
            <h3 className="font-bold text-gray-700 dark:text-gray-200 mb-4">✨ Ghi nhận việc tốt</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Ai đã làm?</label>
                <div className="flex gap-2 flex-wrap">
                  {members.map((m) => (
                    <button key={m.id} onClick={() => setForm({ ...form, memberId: m.id })}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                        form.memberId === m.id ? 'bg-amber-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                      }`}>
                      <span>{m.emoji}</span>{m.name}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Việc tốt họ đã làm</label>
                <textarea
                  value={form.deed}
                  onChange={(e) => setForm({ ...form, deed: e.target.value })}
                  placeholder="Mô tả hành động tốt bụng... (vd: Con chủ động giúp Bà lấy nước)"
                  rows={3}
                  className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl p-3 text-sm resize-none"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowAdd(false)} disabled={addDone} className="text-gray-500 px-4 py-2 rounded-xl text-sm hover:bg-gray-100 disabled:opacity-40">Hủy</button>
                <button onClick={submitDeed} disabled={!form.deed.trim() || addDone} className="bg-amber-500 text-white px-4 py-2 rounded-xl font-medium text-sm hover:bg-amber-600 disabled:opacity-50 transition-all">
                  {addDone ? '✅ Đã ghi nhận!' : 'Ghi nhận 🌟'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Deeds feed */}
      {silentHeroes.length > 0 && (
        <div>
          <h3 className="font-bold text-gray-700 dark:text-gray-200 text-sm uppercase tracking-wide mb-3">📜 Những khoảnh khắc đẹp</h3>
          <div className="space-y-3">
            {silentHeroes.map((hero, i) => {
              const member  = members.find((m) => m.id === hero.memberId)
              const loggedBy = members.find((m) => m.id === hero.loggedBy)
              const myReaction = hero.reactions.find((r) => r.memberId === currentMemberId)

              return (
                <motion.div key={hero.id} initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: i * 0.06 }}
                  className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                  {/* Header */}
                  <div className="flex items-center gap-3 mb-3">
                    {member && (
                      <div className={`w-10 h-10 rounded-full ${member.color} flex items-center justify-center text-xl shadow`}>
                        {member.emoji}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 dark:text-white text-sm">{member?.name}</p>
                      <p className="text-xs text-gray-400">
                        Được ghi nhận bởi {loggedBy?.emoji} {loggedBy?.name} · {timeAgo(hero.timestamp)}
                      </p>
                    </div>
                    {isParent && (
                      <button onClick={() => removeSilentHero(hero.id)} className="text-gray-300 hover:text-red-400 text-sm">🗑</button>
                    )}
                  </div>

                  {/* Deed */}
                  <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl px-4 py-3 mb-3">
                    <p className="text-sm text-amber-800 dark:text-amber-200 leading-relaxed">"{hero.deed}"</p>
                  </div>

                  {/* Reactions */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {REACTIONS.map((emoji) => {
                      const count = hero.reactions.filter((r) => r.emoji === emoji).length
                      const isMe = myReaction?.emoji === emoji
                      if (count === 0 && !isMe) return null
                      return (
                        <button key={emoji} onClick={() => reactSilentHero(hero.id, currentMemberId || '', emoji)}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                            isMe ? 'bg-amber-200 dark:bg-amber-800/60 text-amber-800 dark:text-amber-200 scale-105' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-amber-100'
                          }`}>
                          {emoji} {count > 0 && <span>{count}</span>}
                        </button>
                      )
                    })}
                    {/* Add reaction */}
                    {REACTIONS.filter((e) => !hero.reactions.some((r) => r.memberId === currentMemberId && r.emoji === e) || hero.reactions.every((r) => r.memberId !== currentMemberId)).slice(0, 1).map((e, idx) => {
                      if (myReaction) return null
                      return (
                        <div key={idx} className="relative group">
                          <button className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 px-2.5 py-1 rounded-full hover:bg-amber-50 dark:hover:bg-amber-900/30">
                            + phản ứng
                          </button>
                          <div className="absolute bottom-full left-0 mb-1 bg-white dark:bg-gray-800 shadow-lg rounded-2xl p-2 flex gap-1 z-10 invisible group-hover:visible">
                            {REACTIONS.map((emoji) => (
                              <button key={emoji} onClick={() => reactSilentHero(hero.id, currentMemberId || '', emoji)}
                                className="text-xl hover:scale-125 transition-transform p-1">
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      )}

      {silentHeroes.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-5xl mb-3">🦸</p>
          <p className="font-medium">Chưa có anh hùng nào được ghi nhận</p>
          {isParent && <p className="text-sm mt-1">Hãy bắt đầu bằng cách ghi nhận một việc tốt!</p>}
        </div>
      )}
    </div>
  )
}
