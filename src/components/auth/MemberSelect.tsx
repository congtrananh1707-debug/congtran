import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../../store/useStore'

export default function MemberSelect() {
  const members          = useStore((s) => s.members)
  const setCurrentMember = useStore((s) => s.setCurrentMember)
  const logout           = useStore((s) => s.logout)
  const appName          = useStore((s) => s.appName)
  const parentPin        = useStore((s) => s.parentPin)

  // Per-member PIN gate. The personal pin lives on the member; we fall
  // back to the legacy parentPin if a parent hasn't set a personal one
  // yet so families upgrading from earlier versions don't lose the lock.
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [pinInput, setPinInput]   = useState('')
  const [pinError, setPinError]   = useState(false)

  const pinForMember = (m: { role: string; pin?: string }): string => {
    if (m.pin) return m.pin
    if ((m.role === 'dad' || m.role === 'mom') && parentPin) return parentPin
    return ''
  }

  const handleSelect = (id: string) => {
    const member = members.find((m) => m.id === id)
    if (!member) return
    const required = pinForMember(member)
    if (required) {
      setPendingId(id); setPinInput(''); setPinError(false)
    } else {
      setCurrentMember(id)
    }
  }

  const confirmPin = () => {
    const member = members.find((m) => m.id === pendingId)
    if (!member) { setPendingId(null); return }
    if (pinInput === pinForMember(member)) {
      setCurrentMember(member.id)
      setPendingId(null)
    } else {
      setPinError(true); setPinInput('')
    }
  }

  const pendingMember = pendingId ? members.find((m) => m.id === pendingId) : null

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-400 via-orange-400 to-rose-400 flex flex-col items-center justify-center p-6">
      <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-center mb-10">
        <div className="text-6xl mb-3">👨‍👩‍👧</div>
        <h2 className="text-3xl font-bold text-white">{appName}</h2>
        <p className="text-orange-100 mt-1">Bạn là ai trong gia đình?</p>
      </motion.div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 w-full max-w-lg">
        {members.map((m, i) => {
          const isParent = m.role === 'dad' || m.role === 'mom'
          const required = pinForMember(m)
          const locked = required.length > 0
          return (
            <motion.button
              key={m.id}
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: i * 0.08 }}
              onClick={() => handleSelect(m.id)}
              className="bg-white/90 backdrop-blur rounded-3xl p-6 flex flex-col items-center gap-3 hover:bg-white hover:scale-105 transition-all shadow-lg active:scale-95 relative"
            >
              {locked && (
                <span className="absolute top-2 right-2 text-sm" title="Cần PIN">🔒</span>
              )}
              <div className={`w-16 h-16 rounded-full ${m.color} flex items-center justify-center text-3xl shadow-md overflow-hidden`}>
                {m.avatarUrl
                  ? <img src={m.avatarUrl} alt={m.name} className="w-full h-full object-cover" />
                  : <span>{m.emoji}</span>}
              </div>
              <span className="font-bold text-gray-800 text-lg">{m.name}</span>
              {m.role === 'child' && (
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                  🪙 {m.tokens} xu
                </span>
              )}
              {isParent && (
                <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">
                  {locked ? '🔒 Phụ huynh' : 'Phụ huynh'}
                </span>
              )}
            </motion.button>
          )
        })}
      </div>

      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        onClick={logout}
        className="mt-10 text-orange-100 hover:text-white text-sm underline"
      >
        ← Đổi gia đình (đăng xuất)
      </motion.button>

      {/* Per-member PIN modal */}
      <AnimatePresence>
        {pendingMember && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6"
            onClick={() => setPendingId(null)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-white rounded-3xl p-8 w-full max-w-xs shadow-2xl text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className={`w-20 h-20 rounded-full ${pendingMember.color} flex items-center justify-center text-4xl shadow-md mx-auto mb-3 overflow-hidden`}>
                {pendingMember.avatarUrl
                  ? <img src={pendingMember.avatarUrl} alt={pendingMember.name} className="w-full h-full object-cover" />
                  : <span>{pendingMember.emoji}</span>}
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-1">{pendingMember.name}</h3>
              <p className="text-sm text-gray-500 mb-5">Nhập PIN cá nhân để vào</p>

              <input
                type="password"
                value={pinInput}
                onChange={(e) => { setPinInput(e.target.value.replace(/\D/g, '').slice(0, 8)); setPinError(false) }}
                onKeyDown={(e) => e.key === 'Enter' && confirmPin()}
                placeholder="••••"
                inputMode="numeric"
                autoFocus
                className={`w-full text-center text-2xl tracking-widest border-2 rounded-xl p-3 mb-3 outline-none transition-colors ${
                  pinError ? 'border-red-400 bg-red-50' : 'border-gray-200 focus:border-violet-400'
                }`}
                maxLength={8}
              />
              {pinError && <p className="text-red-500 text-sm mb-3">PIN không đúng, thử lại!</p>}

              <div className="flex gap-3">
                <button
                  onClick={() => setPendingId(null)}
                  className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-xl font-medium hover:bg-gray-200"
                >
                  Hủy
                </button>
                <button
                  onClick={confirmPin}
                  className="flex-1 bg-violet-600 text-white py-3 rounded-xl font-medium hover:bg-violet-700"
                >
                  Vào
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
