import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../../store/useStore'
import { formatDateTime } from '../../utils/helpers'
import { MOOD_CONFIG, REACTION_CONFIG } from '../../types'
import type { MoodTag, MailReaction } from '../../types'

export default function SecretMailbox() {
  const mails = useStore((s) => s.mails)
  const members = useStore((s) => s.members)
  const currentMemberId = useStore((s) => s.currentMemberId)
  const sendMail = useStore((s) => s.sendMail)
  const replyMail = useStore((s) => s.replyMail)
  const reactMail = useStore((s) => s.reactMail)
  const markRead = useStore((s) => s.markRead)

  const [view, setView] = useState<'inbox' | 'compose' | 'read'>('inbox')
  const [selectedMail, setSelectedMail] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [compose, setCompose] = useState({ to: [] as string[], subject: '', body: '', mood: 'happy' as MoodTag })

  const me = members.find((m) => m.id === currentMemberId)
  const others = members.filter((m) => m.id !== currentMemberId)

  const inbox = mails.filter((m) => m.to.includes(currentMemberId || '') || m.from === currentMemberId)
  const unreadCount = inbox.filter((m) => !m.readBy.includes(currentMemberId || '') && m.from !== currentMemberId).length

  const openMail = (id: string) => {
    setSelectedMail(id)
    setView('read')
    markRead(id, currentMemberId || '')
  }

  const mail = mails.find((m) => m.id === selectedMail)

  const sendReply = () => {
    if (!replyText.trim() || !selectedMail) return
    replyMail(selectedMail, currentMemberId || '', replyText.trim())
    setReplyText('')
  }

  const submitCompose = () => {
    if (!compose.subject.trim() || !compose.body.trim() || compose.to.length === 0) return
    sendMail(currentMemberId || '', compose.to, compose.subject, compose.body, compose.mood)
    setCompose({ to: [], subject: '', body: '', mood: 'happy' })
    setView('inbox')
  }

  const toggleTo = (id: string) => {
    setCompose((prev) => ({
      ...prev,
      to: prev.to.includes(id) ? prev.to.filter((t) => t !== id) : [...prev.to, id],
    }))
  }

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">✉️ Hộp thư bí mật</h1>
          {unreadCount > 0 && (
            <p className="text-rose-600 text-sm font-medium mt-0.5">📬 {unreadCount} thư chưa đọc</p>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setView('inbox')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${view === 'inbox' ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
            📥 Hộp thư
          </button>
          <button onClick={() => setView('compose')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${view === 'compose' ? 'bg-rose-500 text-white' : 'bg-rose-100 text-rose-700'}`}>
            ✍️ Viết thư
          </button>
        </div>
      </div>

      {/* Inbox */}
      {view === 'inbox' && (
        <div className="space-y-3">
          {inbox.length === 0 && (
            <div className="text-center py-20 text-gray-400">
              <p className="text-5xl mb-3">📪</p>
              <p>Hộp thư trống. Viết thư cho gia đình nào!</p>
            </div>
          )}
          {inbox.map((m, i) => {
            const sender = members.find((mb) => mb.id === m.from)
            const isUnread = !m.readBy.includes(currentMemberId || '') && m.from !== currentMemberId
            const mood = MOOD_CONFIG[m.mood]

            return (
              <motion.div key={m.id} initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: i * 0.05 }}
                onClick={() => openMail(m.id)}
                className={`bg-white rounded-2xl p-4 shadow-sm border cursor-pointer hover:shadow-md transition-all ${isUnread ? 'border-violet-200 bg-violet-50/50' : 'border-gray-100'}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-full ${sender?.color} flex items-center justify-center text-xl flex-shrink-0`}>
                    {sender?.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-800 text-sm">{sender?.name}</span>
                      {isUnread && <span className="w-2 h-2 bg-violet-500 rounded-full" />}
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${mood.color}`}>{mood.emoji} {mood.label}</span>
                    </div>
                    <p className="font-medium text-gray-700 text-sm truncate">{m.subject}</p>
                    <p className="text-xs text-gray-400 truncate">{m.body}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                      <span>{formatDateTime(m.timestamp)}</span>
                      {m.reactions.length > 0 && <span>{m.reactions.map((r) => REACTION_CONFIG[r.type].emoji).join('')}</span>}
                      {m.replies.length > 0 && <span>💬 {m.replies.length}</span>}
                    </div>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Read mail */}
      {view === 'read' && mail && (() => {
        const sender = members.find((mb) => mb.id === mail.from)
        const mood = MOOD_CONFIG[mail.mood]
        const myReaction = mail.reactions.find((r) => r.memberId === currentMemberId)

        return (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <button onClick={() => setView('inbox')} className="text-gray-500 hover:text-gray-700 text-sm flex items-center gap-1 mb-4">← Quay lại</button>

            <div className="bg-white rounded-3xl p-5 shadow-md border border-gray-100 mb-4">
              {/* Mail header */}
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-12 h-12 rounded-full ${sender?.color} flex items-center justify-center text-2xl`}>{sender?.emoji}</div>
                <div>
                  <p className="font-bold text-gray-800">{sender?.name}</p>
                  <p className="text-xs text-gray-400">{formatDateTime(mail.timestamp)}</p>
                </div>
                <span className={`ml-auto text-sm px-3 py-1 rounded-full border ${mood.color}`}>{mood.emoji} {mood.label}</span>
              </div>

              <h2 className="text-xl font-bold text-gray-800 mb-3">{mail.subject}</h2>
              <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{mail.body}</p>

              {/* Reactions */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-400 mb-2">Phản ứng của bạn:</p>
                <div className="flex gap-2 flex-wrap">
                  {(Object.keys(REACTION_CONFIG) as MailReaction[]).map((type) => {
                    const rc = REACTION_CONFIG[type]
                    const active = myReaction?.type === type
                    const count = mail.reactions.filter((r) => r.type === type).length
                    return (
                      <button key={type} onClick={() => reactMail(mail.id, currentMemberId || '', type)}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-sm transition-all border ${active ? 'bg-rose-100 border-rose-300 text-rose-700' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}>
                        {rc.emoji} {rc.label} {count > 0 && <span className="font-bold">{count}</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Replies */}
            {mail.replies.length > 0 && (
              <div className="space-y-3 mb-4">
                {mail.replies.map((r) => {
                  const replier = members.find((mb) => mb.id === r.from)
                  return (
                    <div key={r.id} className={`bg-white rounded-2xl p-4 shadow-sm border border-gray-100 ${r.from === currentMemberId ? 'ml-8' : 'mr-8'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-7 h-7 rounded-full ${replier?.color} flex items-center justify-center text-sm`}>{replier?.emoji}</div>
                        <span className="font-semibold text-sm text-gray-700">{replier?.name}</span>
                        <span className="text-xs text-gray-400 ml-auto">{formatDateTime(r.timestamp)}</span>
                      </div>
                      <p className="text-gray-700 text-sm">{r.body}</p>
                      {r.reaction && <p className="text-lg mt-1">{REACTION_CONFIG[r.reaction].emoji}</p>}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Reply box */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <p className="text-sm font-medium text-gray-600 mb-2">Trả lời...</p>
              <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)}
                placeholder="Viết phản hồi của bạn..." rows={3}
                className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none mb-3" />
              <button onClick={sendReply} disabled={!replyText.trim()}
                className="bg-violet-600 text-white px-4 py-2 rounded-xl font-medium text-sm hover:bg-violet-700 disabled:opacity-50">
                Gửi ❤️
              </button>
            </div>
          </motion.div>
        )
      })()}

      {/* Compose */}
      {view === 'compose' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-3xl p-5 shadow-md border border-gray-100">
          <h2 className="font-bold text-gray-700 text-lg mb-4">✍️ Viết thư mới</h2>

          {/* Mood */}
          <div className="mb-4">
            <label className="text-xs text-gray-400 uppercase font-medium block mb-2">Tâm trạng của bạn</label>
            <div className="flex gap-2 flex-wrap">
              {(Object.keys(MOOD_CONFIG) as MoodTag[]).map((mood) => {
                const cfg = MOOD_CONFIG[mood]
                return (
                  <button key={mood} onClick={() => setCompose({ ...compose, mood })}
                    className={`text-sm px-3 py-2 rounded-xl border transition-all ${compose.mood === mood ? cfg.color : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'}`}>
                    {cfg.emoji} {cfg.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* To */}
          <div className="mb-4">
            <label className="text-xs text-gray-400 uppercase font-medium block mb-2">Gửi cho</label>
            <div className="flex gap-2 flex-wrap">
              {others.map((m) => (
                <button key={m.id} onClick={() => toggleTo(m.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all text-sm ${compose.to.includes(m.id) ? 'bg-violet-100 border-violet-400 text-violet-700' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}>
                  {m.emoji} {m.name}
                </button>
              ))}
            </div>
          </div>

          {/* Subject */}
          <div className="mb-3">
            <label className="text-xs text-gray-400 uppercase font-medium block mb-1">Tiêu đề</label>
            <input value={compose.subject} onChange={(e) => setCompose({ ...compose, subject: e.target.value })}
              placeholder="VD: Con yêu bố mẹ!" className="w-full border border-gray-200 rounded-xl p-3 text-sm" />
          </div>

          {/* Body */}
          <div className="mb-4">
            <label className="text-xs text-gray-400 uppercase font-medium block mb-1">Nội dung</label>
            <textarea value={compose.body} onChange={(e) => setCompose({ ...compose, body: e.target.value })}
              placeholder="Viết điều bạn muốn nói..." rows={5}
              className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none" />
          </div>

          <div className="flex gap-3">
            <button onClick={submitCompose}
              disabled={!compose.subject.trim() || !compose.body.trim() || compose.to.length === 0}
              className="flex-1 bg-rose-500 hover:bg-rose-600 text-white py-3 rounded-xl font-medium disabled:opacity-50">
              💌 Gửi thư
            </button>
            <button onClick={() => setView('inbox')} className="px-4 py-3 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 font-medium">Hủy</button>
          </div>
        </motion.div>
      )}
    </div>
  )
}
