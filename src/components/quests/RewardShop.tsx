import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../../store/useStore'

const REWARD_EMOJIS = ['🎬', '🎮', '🍕', '🍦', '🎡', '🧸', '🎁', '🎈', '🎠', '🏖️', '🎭', '🛍️', '🍰', '🎊', '🎯']

export default function RewardShop() {
  const rewards = useStore((s) => s.rewards)
  const members = useStore((s) => s.members)
  const currentMemberId = useStore((s) => s.currentMemberId)
  const addReward = useStore((s) => s.addReward)
  const updateReward = useStore((s) => s.updateReward)
  const removeReward = useStore((s) => s.removeReward)
  const redeemReward = useStore((s) => s.redeemReward)

  const me = members.find((m) => m.id === currentMemberId)
  const isParent = me?.role === 'dad' || me?.role === 'mom'
  const children = members.filter((m) => m.role === 'child')

  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', emoji: '🎁', tokenCost: 50 })
  const [redeemFor, setRedeemFor] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  const openAdd = () => {
    setEditingId(null)
    setForm({ name: '', emoji: '🎁', tokenCost: 50 })
    setShowAdd(true)
  }

  const openEdit = (id: string) => {
    const r = rewards.find((x) => x.id === id)
    if (!r) return
    setEditingId(id)
    setForm({ name: r.name, emoji: r.emoji, tokenCost: r.tokenCost })
    setShowAdd(true)
  }

  const submit = () => {
    if (!form.name.trim()) return
    if (editingId) {
      updateReward(editingId, { name: form.name.trim(), emoji: form.emoji, tokenCost: form.tokenCost })
    } else {
      addReward(form.name.trim(), form.emoji, form.tokenCost)
    }
    setForm({ name: '', emoji: '🎁', tokenCost: 50 })
    setEditingId(null)
    setShowAdd(false)
  }

  const handleRedeem = (rewardId: string, memberId: string) => {
    const ok = redeemReward(rewardId, memberId)
    const reward = rewards.find((r) => r.id === rewardId)
    const member = members.find((m) => m.id === memberId)
    if (ok) showToast(`🎉 ${member?.name} đã đổi "${reward?.name}"!`)
    else showToast('❌ Không đủ xu!')
    setRedeemFor(null)
  }

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-800 text-white px-5 py-3 rounded-2xl shadow-xl text-sm font-medium">
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">🎁 Cửa hàng phần thưởng</h1>
          {!isParent && me && <p className="text-amber-600 font-semibold mt-0.5">🪙 Bạn có {me.tokens} xu</p>}
        </div>
        {isParent && !showAdd && (
          <button onClick={openAdd} className="bg-amber-500 text-white px-4 py-2 rounded-xl font-medium text-sm hover:bg-amber-600">
            + Thêm phần thưởng
          </button>
        )}
      </div>

      {/* Token balance for children */}
      {!isParent && children.length > 0 && (
        <div className="flex gap-3 mb-5 overflow-x-auto">
          {children.map((c) => (
            <div key={c.id} className={`flex-shrink-0 bg-gradient-to-br from-amber-400 to-orange-500 text-white rounded-2xl px-4 py-3 flex items-center gap-3 ${c.id === currentMemberId ? 'ring-2 ring-amber-300 shadow-lg' : 'opacity-75'}`}>
              <div className={`w-10 h-10 rounded-full ${c.color} flex items-center justify-center text-xl`}>{c.emoji}</div>
              <div>
                <p className="font-bold text-sm">{c.name}</p>
                <p className="text-amber-100 text-xs">🪙 {c.tokens} xu</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="bg-white rounded-3xl p-5 shadow-md border border-gray-100 mb-5"
          >
            <h3 className="font-bold text-gray-700 mb-4">{editingId ? '✏️ Sửa phần thưởng' : '✨ Thêm phần thưởng mới'}</h3>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Tên phần thưởng</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="VD: Xem phim 30 phút..." className="w-full border border-gray-200 rounded-xl p-2.5 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Giá (xu)</label>
                <input type="number" value={form.tokenCost} min={1} onChange={(e) => setForm({ ...form, tokenCost: parseInt(e.target.value) || 1 })}
                  className="w-full border border-gray-200 rounded-xl p-2.5 text-sm" />
              </div>
            </div>
            <div className="mb-4">
              <label className="text-xs text-gray-400 block mb-2">Icon</label>
              <div className="flex flex-wrap gap-2">
                {REWARD_EMOJIS.map((e) => (
                  <button key={e} onClick={() => setForm({ ...form, emoji: e })}
                    className={`text-2xl p-1.5 rounded-xl transition-all ${form.emoji === e ? 'bg-amber-100 ring-2 ring-amber-400' : 'hover:bg-gray-100'}`}>{e}</button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setShowAdd(false); setEditingId(null) }} className="text-gray-500 px-4 py-2 rounded-xl text-sm hover:bg-gray-100">Hủy</button>
              <button onClick={submit} className="bg-amber-500 text-white px-4 py-2 rounded-xl font-medium text-sm hover:bg-amber-600">
                {editingId ? 'Lưu thay đổi' : 'Thêm'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rewards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {rewards.filter((r) => r.active).map((r, i) => {
          const canAfford = !isParent && me && me.tokens >= r.tokenCost

          return (
            <motion.div key={r.id} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: i * 0.06 }}
              className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-4 mb-3">
                <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center text-4xl">
                  {r.emoji}
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-gray-800">{r.name}</h3>
                  <p className="text-amber-600 font-bold text-lg">🪙 {r.tokenCost} xu</p>
                </div>
              </div>

              {/* Redeem */}
              {!isParent && (
                redeemFor === r.id ? (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600 font-medium">Đổi thưởng cho ai?</p>
                    {children.map((c) => (
                      <button key={c.id} onClick={() => handleRedeem(r.id, c.id)}
                        className={`w-full flex items-center gap-2 p-2 rounded-xl text-sm transition-all ${c.tokens >= r.tokenCost ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-gray-50 text-gray-400 cursor-not-allowed'}`}
                        disabled={c.tokens < r.tokenCost}>
                        <span>{c.emoji}</span>
                        <span className="font-medium">{c.name}</span>
                        <span className="ml-auto">🪙 {c.tokens}</span>
                        {c.tokens < r.tokenCost && <span className="text-xs text-red-400">Thiếu {r.tokenCost - c.tokens}</span>}
                      </button>
                    ))}
                    <button onClick={() => setRedeemFor(null)} className="w-full text-sm text-gray-400 hover:text-gray-600 py-1">Hủy</button>
                  </div>
                ) : (
                  <button
                    onClick={() => isParent ? setRedeemFor(r.id) : handleRedeem(r.id, currentMemberId || '')}
                    disabled={!isParent && !canAfford}
                    className={`w-full py-2.5 rounded-xl font-medium text-sm transition-all active:scale-95 ${
                      canAfford || isParent
                        ? 'bg-amber-500 hover:bg-amber-600 text-white'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {canAfford || isParent ? '🎁 Đổi thưởng' : `Cần thêm ${r.tokenCost - (me?.tokens || 0)} xu`}
                  </button>
                )
              )}

              {isParent && (
                <div className="flex gap-2">
                  <button onClick={() => setRedeemFor(redeemFor === r.id ? null : r.id)}
                    className="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-2 rounded-xl text-sm font-medium">
                    🎁 Đổi cho con
                  </button>
                  <button onClick={() => openEdit(r.id)} className="bg-gray-100 hover:bg-violet-100 text-gray-500 hover:text-violet-600 px-3 py-2 rounded-xl text-sm" title="Sửa">
                    ✏️
                  </button>
                  <button onClick={() => removeReward(r.id)} className="bg-gray-100 hover:bg-red-100 text-gray-500 hover:text-red-500 px-3 py-2 rounded-xl text-sm" title="Xóa">
                    🗑
                  </button>
                </div>
              )}

              {isParent && redeemFor === r.id && (
                <div className="mt-2 space-y-1">
                  {children.map((c) => (
                    <button key={c.id} onClick={() => handleRedeem(r.id, c.id)}
                      className={`w-full flex items-center gap-2 p-2 rounded-xl text-sm ${c.tokens >= r.tokenCost ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-gray-50 text-gray-400'}`}
                      disabled={c.tokens < r.tokenCost}>
                      {c.emoji} {c.name} · 🪙 {c.tokens}
                      {c.tokens < r.tokenCost && <span className="ml-auto text-xs text-red-400">Thiếu xu</span>}
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          )
        })}
      </div>

      {rewards.filter((r) => r.active).length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <p className="text-5xl mb-3">🎁</p>
          <p>Chưa có phần thưởng nào</p>
        </div>
      )}
    </div>
  )
}
