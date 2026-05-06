import { motion } from 'framer-motion'
import { useStore } from '../../store/useStore'
import { formatDate, isOnThisDay, yearsAgo } from '../../utils/helpers'
import type { AppView } from '../../types'

const QUICK_LINKS: { view: AppView; icon: string; label: string; color: string }[] = [
  { view: 'quests', icon: '⚔️', label: 'Nhiệm vụ', color: 'bg-violet-100 text-violet-700' },
  { view: 'rewards', icon: '🎁', label: 'Đổi thưởng', color: 'bg-amber-100 text-amber-700' },
  { view: 'mailbox', icon: '✉️', label: 'Hộp thư', color: 'bg-rose-100 text-rose-700' },
  { view: 'gratitude', icon: '💛', label: 'Biết ơn', color: 'bg-yellow-100 text-yellow-700' },
  { view: 'wheel', icon: '🎡', label: 'Vòng quay', color: 'bg-green-100 text-green-700' },
  { view: 'quiz', icon: '🧠', label: 'Đố vui', color: 'bg-blue-100 text-blue-700' },
  { view: 'memory', icon: '📸', label: 'Album', color: 'bg-pink-100 text-pink-700' },
  { view: 'profiles', icon: '👨‍👩‍👧', label: 'Gia đình', color: 'bg-indigo-100 text-indigo-700' },
]

type Props = { setView: (v: AppView) => void; setProfileId: (id: string) => void }

export default function Dashboard({ setView, setProfileId }: Props) {
  const currentMemberId = useStore((s) => s.currentMemberId)
  const members = useStore((s) => s.members)
  const quests = useStore((s) => s.quests)
  const mails = useStore((s) => s.mails)
  const familyQuests = useStore((s) => s.familyQuests)
  const photos = useStore((s) => s.photos)
  const albums = useStore((s) => s.albums)
  const incrementFamilyQuest = useStore((s) => s.incrementFamilyQuest)

  const me = members.find((m) => m.id === currentMemberId)
  const isParent = me?.role === 'dad' || me?.role === 'mom'

  const pendingQuests = quests.filter((q) => q.status === 'pending')
  const unreadMails = mails.filter((m) => !m.readBy.includes(currentMemberId || '') && m.to.includes(currentMemberId || ''))
  const myActiveQuests = quests.filter((q) => q.status === 'active' && q.assignedTo.includes(currentMemberId || ''))

  // On This Day
  const onThisDayPhotos = photos.filter((p) => {
    const d = new Date(p.date)
    const now = new Date()
    return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() < now.getFullYear()
  })

  const birthdayMembers = members.filter((m) => m.birthday && isOnThisDay(m.birthday))

  const activeFamilyQuest = familyQuests.find((fq) => fq.active)

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Chào buổi sáng' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối'

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      {/* Greeting */}
      <motion.div initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        <div className="flex items-center gap-4 mb-6">
          {me && (
            <button onClick={() => { setView('profile'); setProfileId(me.id) }}
              className={`w-14 h-14 rounded-full ${me.color} flex items-center justify-center text-3xl shadow-md hover:scale-105 transition-transform`}>
              {me.emoji}
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{greeting}, {me?.name}! 👋</h1>
            <p className="text-gray-500 text-sm">
              {new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Birthday alert */}
      {birthdayMembers.length > 0 && (
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-3xl p-4 mb-4 flex items-center gap-3 shadow-lg"
        >
          <span className="text-4xl">🎂</span>
          <div>
            <p className="font-bold text-lg">Hôm nay là sinh nhật!</p>
            <p>{birthdayMembers.map((m) => `${m.emoji} ${m.name} (${yearsAgo(m.birthday)} tuổi)`).join(', ')}</p>
          </div>
        </motion.div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { icon: '⚔️', value: myActiveQuests.length, label: 'Nhiệm vụ chờ', color: 'bg-violet-50 border-violet-200', textColor: 'text-violet-700' },
          { icon: '✉️', value: unreadMails.length, label: 'Thư chưa đọc', color: 'bg-rose-50 border-rose-200', textColor: 'text-rose-700' },
          { icon: '⏳', value: pendingQuests.length, label: 'Chờ duyệt', color: 'bg-amber-50 border-amber-200', textColor: 'text-amber-700', show: isParent },
          { icon: '🪙', value: me?.tokens ?? 0, label: 'Xu của bạn', color: 'bg-emerald-50 border-emerald-200', textColor: 'text-emerald-700' },
        ].filter((s) => s.show !== false).map((stat, i) => (
          <motion.div key={i} initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: i * 0.05 }}
            className={`${stat.color} border rounded-2xl p-4 text-center`}
          >
            <div className="text-2xl mb-1">{stat.icon}</div>
            <div className={`text-2xl font-bold ${stat.textColor}`}>{stat.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{stat.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Family Quest Progress */}
      {activeFamilyQuest && (
        <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          className="bg-gradient-to-r from-violet-500 to-indigo-500 text-white rounded-3xl p-5 mb-6 shadow-lg"
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-violet-200 font-medium">NHIỆM VỤ GIA ĐÌNH</p>
              <p className="font-bold text-lg">{activeFamilyQuest.title}</p>
            </div>
            <span className="text-4xl">👨‍👩‍👧</span>
          </div>
          <div className="bg-white/20 rounded-full h-3 mb-2">
            <motion.div
              className="bg-white rounded-full h-3"
              initial={{ width: 0 }}
              animate={{ width: `${(activeFamilyQuest.currentDays / activeFamilyQuest.targetDays) * 100}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
            />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span>{activeFamilyQuest.currentDays}/{activeFamilyQuest.targetDays} ngày</span>
            {isParent && (
              <button onClick={() => incrementFamilyQuest(activeFamilyQuest.id)}
                className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded-xl text-sm font-medium">
                ✅ Hoàn thành hôm nay
              </button>
            )}
          </div>
        </motion.div>
      )}

      {/* Quick links */}
      <div className="mb-6">
        <h2 className="font-bold text-gray-700 mb-3 text-sm uppercase tracking-wide">Truy cập nhanh</h2>
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
          {QUICK_LINKS.map((link, i) => (
            <motion.button
              key={link.view}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => setView(link.view)}
              className={`${link.color} rounded-2xl p-3 flex flex-col items-center gap-1.5 hover:scale-105 transition-transform`}
            >
              <span className="text-2xl">{link.icon}</span>
              <span className="text-xs font-medium leading-tight text-center">{link.label}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Family members row */}
      <div className="mb-6">
        <h2 className="font-bold text-gray-700 mb-3 text-sm uppercase tracking-wide">Thành viên gia đình</h2>
        <div className="flex gap-3 flex-wrap">
          {members.map((m) => (
            <button key={m.id} onClick={() => { setView('profile'); setProfileId(m.id) }}
              className="flex items-center gap-2 bg-white rounded-2xl px-4 py-2.5 shadow-sm hover:shadow-md hover:scale-105 transition-all border border-gray-100">
              <div className={`w-9 h-9 rounded-full ${m.color} flex items-center justify-center text-lg`}>{m.emoji}</div>
              <div className="text-left">
                <p className="font-semibold text-gray-800 text-sm">{m.name}</p>
                {m.role === 'child' && <p className="text-xs text-amber-600">🪙 {m.tokens} xu</p>}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* On This Day */}
      {onThisDayPhotos.length > 0 && (
        <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mb-6">
          <h2 className="font-bold text-gray-700 mb-3 text-sm uppercase tracking-wide">📅 Ngày này năm xưa</h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {onThisDayPhotos.slice(0, 5).map((p) => {
              const album = albums.find((a) => a.id === p.albumId)
              return (
                <div key={p.id} onClick={() => setView('memory')}
                  className="flex-shrink-0 w-40 bg-white rounded-2xl overflow-hidden shadow-md cursor-pointer hover:scale-105 transition-transform">
                  <img src={p.dataUrl} alt={p.caption} className="w-full h-28 object-cover" />
                  <div className="p-2">
                    <p className="text-xs font-medium text-gray-700 truncate">{p.caption || album?.title}</p>
                    <p className="text-xs text-gray-400">{p.date}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>
      )}

      {/* Pending quest approvals (parent only) */}
      {isParent && pendingQuests.length > 0 && (
        <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
          <h2 className="font-bold text-gray-700 mb-3 text-sm uppercase tracking-wide">⏳ Chờ phê duyệt</h2>
          <div className="space-y-2">
            {pendingQuests.slice(0, 3).map((q) => {
              const child = members.find((m) => m.id === q.completedBy)
              return (
                <div key={q.id} className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-800 text-sm">{q.title}</p>
                    <p className="text-xs text-gray-500">{child?.emoji} {child?.name} đã hoàn thành · {q.tokens} xu</p>
                  </div>
                  <button onClick={() => setView('quests')} className="text-xs bg-violet-600 text-white px-3 py-1.5 rounded-xl font-medium">Xem</button>
                </div>
              )
            })}
          </div>
        </motion.div>
      )}
    </div>
  )
}
