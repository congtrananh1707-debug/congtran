import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../../store/useStore'
import { shuffle } from '../../utils/helpers'
import type { WheelItem } from '../../types'

const WHEEL_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#82E0AA']

export default function MagicWheel() {
  const wheelItems = useStore((s) => s.wheelItems)
  const addWheelItem = useStore((s) => s.addWheelItem)
  const removeWheelItem = useStore((s) => s.removeWheelItem)
  const currentMemberId = useStore((s) => s.currentMemberId)
  const members = useStore((s) => s.members)
  const me = members.find((m) => m.id === currentMemberId)
  const isParent = me?.role === 'dad' || me?.role === 'mom'

  const [category, setCategory] = useState<'activity' | 'menu'>('activity')
  const [spinning, setSpinning] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [result, setResult] = useState<WheelItem | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ label: '', emoji: '🎯' })
  const spinRef = useRef(0)

  const items = wheelItems.filter((w) => w.category === category)

  const spin = () => {
    if (spinning || items.length < 2) return
    setResult(null)
    setSpinning(true)

    const spins = 5 + Math.floor(Math.random() * 5)
    const extraDeg = Math.floor(Math.random() * 360)
    const totalDeg = spins * 360 + extraDeg
    const newRotation = rotation + totalDeg
    setRotation(newRotation)

    setTimeout(() => {
      setSpinning(false)
      const segSize = 360 / items.length
      const normalizedDeg = ((360 - (newRotation % 360)) + 90) % 360
      const idx = Math.floor(normalizedDeg / segSize) % items.length
      setResult(items[idx])
    }, 3500)
  }

  const submit = () => {
    if (!form.label.trim()) return
    addWheelItem(category, form.label.trim(), form.emoji)
    setForm({ label: '', emoji: '🎯' })
    setShowAdd(false)
  }

  const segSize = items.length > 0 ? 360 / items.length : 360
  const radius = 140
  const cx = 160
  const cy = 160

  const getSegPath = (index: number) => {
    const startAngle = (index * segSize - 90) * (Math.PI / 180)
    const endAngle = ((index + 1) * segSize - 90) * (Math.PI / 180)
    const x1 = cx + radius * Math.cos(startAngle)
    const y1 = cy + radius * Math.sin(startAngle)
    const x2 = cx + radius * Math.cos(endAngle)
    const y2 = cy + radius * Math.sin(endAngle)
    const largeArc = segSize > 180 ? 1 : 0
    return `M${cx},${cy} L${x1},${y1} A${radius},${radius} 0 ${largeArc},1 ${x2},${y2} Z`
  }

  const getTextPos = (index: number) => {
    const angle = ((index + 0.5) * segSize - 90) * (Math.PI / 180)
    return {
      x: cx + (radius * 0.65) * Math.cos(angle),
      y: cy + (radius * 0.65) * Math.sin(angle),
    }
  }

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto">
      <div className="text-center mb-5">
        <h1 className="text-2xl font-bold text-gray-800">🎡 Vòng quay may mắn</h1>
        <p className="text-gray-500 text-sm">Quay để chọn hoạt động hoặc thực đơn ngẫu nhiên!</p>
      </div>

      {/* Category switch */}
      <div className="flex gap-2 justify-center mb-6">
        <button onClick={() => { setCategory('activity'); setResult(null) }}
          className={`px-5 py-2.5 rounded-xl font-medium text-sm transition-all ${category === 'activity' ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
          🎮 Hoạt động cuối tuần
        </button>
        <button onClick={() => { setCategory('menu'); setResult(null) }}
          className={`px-5 py-2.5 rounded-xl font-medium text-sm transition-all ${category === 'menu' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
          🍽️ Thực đơn bữa tối
        </button>
      </div>

      {/* Wheel */}
      <div className="flex flex-col items-center">
        <div className="relative mb-6">
          {/* Pointer */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-10 text-3xl">▼</div>

          <motion.svg
            width="320" height="320" viewBox="0 0 320 320"
            style={{ filter: 'drop-shadow(0 10px 30px rgba(0,0,0,0.15))' }}
            animate={{ rotate: rotation }}
            transition={{ duration: 3.5, ease: [0.17, 0.67, 0.35, 1] }}
          >
            {items.length === 0 ? (
              <circle cx={cx} cy={cy} r={radius} fill="#e5e7eb" />
            ) : (
              items.map((item, i) => {
                const pos = getTextPos(i)
                return (
                  <g key={item.id}>
                    <path d={getSegPath(i)} fill={WHEEL_COLORS[i % WHEEL_COLORS.length]} stroke="white" strokeWidth="2" />
                    <text x={pos.x} y={pos.y - 8} textAnchor="middle" fontSize="16" dy="0.35em">{item.emoji}</text>
                    <text x={pos.x} y={pos.y + 12} textAnchor="middle" fontSize="9" fill="rgba(0,0,0,0.7)" fontWeight="600">
                      {item.label.length > 8 ? item.label.slice(0, 8) + '…' : item.label}
                    </text>
                  </g>
                )
              })
            )}
            {/* Center circle */}
            <circle cx={cx} cy={cy} r={24} fill="white" stroke="#e5e7eb" strokeWidth="3" />
            <text x={cx} y={cy} textAnchor="middle" dy="0.35em" fontSize="20">🌟</text>
          </motion.svg>
        </div>

        {/* Spin button */}
        <button
          onClick={spin}
          disabled={spinning || items.length < 2}
          className={`px-10 py-4 rounded-2xl text-xl font-bold shadow-lg transition-all active:scale-95 ${
            spinning || items.length < 2
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-violet-500 to-indigo-500 text-white hover:from-violet-600 hover:to-indigo-600 hover:shadow-xl'
          }`}
        >
          {spinning ? '🌀 Đang quay...' : '🎡 QUAY NGAY!'}
        </button>

        {items.length < 2 && (
          <p className="text-sm text-gray-400 mt-2">Cần ít nhất 2 mục để quay</p>
        )}

        {/* Result */}
        <AnimatePresence>
          {result && (
            <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
              className="mt-6 bg-gradient-to-br from-violet-500 to-indigo-500 text-white rounded-3xl p-6 text-center shadow-xl"
            >
              <p className="text-sm font-medium text-violet-200 mb-1">🎉 Kết quả</p>
              <p className="text-5xl mb-2">{result.emoji}</p>
              <p className="text-2xl font-bold">{result.label}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Items list */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-gray-700 text-sm">Danh sách ({items.length})</h3>
          {isParent && (
            <button onClick={() => setShowAdd(!showAdd)} className="text-sm bg-gray-100 text-gray-600 px-3 py-1.5 rounded-xl hover:bg-gray-200">+ Thêm</button>
          )}
        </div>

        {showAdd && isParent && (
          <div className="bg-gray-50 rounded-2xl p-3 mb-3 flex gap-2">
            <input value={form.emoji} onChange={(e) => setForm({ ...form, emoji: e.target.value })}
              className="w-12 border border-gray-200 rounded-xl p-2 text-center text-lg" maxLength={2} />
            <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder="Tên mục..." className="flex-1 border border-gray-200 rounded-xl p-2 text-sm" />
            <button onClick={submit} className="bg-violet-600 text-white px-3 py-2 rounded-xl text-sm">+</button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          {items.map((item, i) => (
            <div key={item.id} className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 shadow-sm border border-gray-100 group">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm" style={{ backgroundColor: WHEEL_COLORS[i % WHEEL_COLORS.length] + '40' }}>
                {item.emoji}
              </div>
              <span className="text-sm text-gray-700 flex-1 truncate">{item.label}</span>
              {isParent && (
                <button onClick={() => removeWheelItem(item.id)} className="text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity text-xs">✕</button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
