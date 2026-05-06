import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../../store/useStore'
import { formatDate } from '../../utils/helpers'
import { NOTE_COLORS } from '../../types'

export default function GratitudeWall() {
  const gratitude = useStore((s) => s.gratitude)
  const members = useStore((s) => s.members)
  const currentMemberId = useStore((s) => s.currentMemberId)
  const addGratitude = useStore((s) => s.addGratitude)
  const removeGratitude = useStore((s) => s.removeGratitude)

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ to: '', message: '', color: NOTE_COLORS[0] })

  const others = members.filter((m) => m.id !== currentMemberId)

  const submit = () => {
    if (!form.to || !form.message.trim()) return
    addGratitude(currentMemberId || '', form.to, form.message.trim(), form.color)
    setForm({ to: '', message: '', color: NOTE_COLORS[0] })
    setShowForm(false)
  }

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">💛 Bức tường biết ơn</h1>
          <p className="text-gray-500 text-sm mt-0.5">Chia sẻ điều bạn trân trọng về nhau</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="bg-yellow-400 hover:bg-yellow-500 text-gray-800 px-4 py-2 rounded-xl font-medium text-sm">
          + Thêm ghi chú
        </button>
      </div>

      {/* Add form */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="bg-white rounded-3xl p-5 shadow-md border border-gray-100 mb-6"
          >
            <h3 className="font-bold text-gray-700 mb-4">🌻 Ghi chú biết ơn</h3>

            <div className="mb-3">
              <label className="text-xs text-gray-400 uppercase font-medium block mb-2">Gửi tới</label>
              <div className="flex gap-2 flex-wrap">
                {others.map((m) => (
                  <button key={m.id} onClick={() => setForm({ ...form, to: m.id })}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-all ${form.to === m.id ? 'bg-yellow-100 border-yellow-400 text-yellow-800' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}>
                    {m.emoji} {m.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-3">
              <label className="text-xs text-gray-400 uppercase font-medium block mb-1">Màu ghi chú</label>
              <div className="flex gap-2">
                {NOTE_COLORS.map((c) => (
                  <button key={c} onClick={() => setForm({ ...form, color: c })}
                    className={`w-8 h-8 rounded-lg border-2 ${c} transition-all ${form.color === c ? 'scale-110 ring-2 ring-gray-400' : ''}`} />
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="text-xs text-gray-400 uppercase font-medium block mb-1">Lời biết ơn</label>
              <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder="VD: Cảm ơn mẹ đã nấu cơm ngon..." rows={3}
                className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none" />
            </div>

            <div className="flex gap-2">
              <button onClick={submit} disabled={!form.to || !form.message.trim()}
                className="bg-yellow-400 hover:bg-yellow-500 text-gray-800 px-5 py-2 rounded-xl font-medium text-sm disabled:opacity-50">
                🌻 Đăng lên tường
              </button>
              <button onClick={() => setShowForm(false)} className="text-gray-500 px-4 py-2 rounded-xl text-sm hover:bg-gray-100">Hủy</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Masonry wall */}
      {gratitude.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-5xl mb-3">🌻</p>
          <p>Tường biết ơn đang trống. Hãy là người đầu tiên đăng!</p>
        </div>
      ) : (
        <div className="columns-1 sm:columns-2 lg:columns-3 gap-4">
          {gratitude.map((g, i) => {
            const from = members.find((m) => m.id === g.from)
            const to = members.find((m) => m.id === g.to)

            return (
              <motion.div
                key={g.id}
                initial={{ opacity: 0, scale: 0.8, rotate: -2 }}
                animate={{ opacity: 1, scale: 1, rotate: (i % 3 - 1) * 1.5 }}
                transition={{ delay: i * 0.05, type: 'spring', stiffness: 200 }}
                className={`break-inside-avoid mb-4 border-2 rounded-2xl p-4 shadow-md hover:rotate-0 hover:scale-105 transition-all cursor-default relative group ${g.color}`}
              >
                {/* To / From */}
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-7 h-7 rounded-full ${from?.color} flex items-center justify-center text-sm`}>{from?.emoji}</div>
                  <span className="text-xs font-bold text-gray-600">{from?.name}</span>
                  <span className="text-gray-400 text-xs">→</span>
                  <div className={`w-7 h-7 rounded-full ${to?.color} flex items-center justify-center text-sm`}>{to?.emoji}</div>
                  <span className="text-xs font-bold text-gray-600">{to?.name}</span>
                </div>

                {/* Message */}
                <p className="text-gray-800 text-sm leading-relaxed">{g.message}</p>
                <p className="text-xs text-gray-500 mt-2">{formatDate(g.timestamp)}</p>

                {/* Delete button */}
                {(g.from === currentMemberId) && (
                  <button onClick={() => removeGratitude(g.id)}
                    className="absolute top-2 right-2 w-6 h-6 bg-white/60 hover:bg-red-100 text-gray-400 hover:text-red-500 rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    ✕
                  </button>
                )}
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
