import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { useStore } from '../../store/useStore'
import { nanoid } from '../../utils/helpers'

type Props = { memberId: string }

export default function HealthChart({ memberId }: Props) {
  const health = useStore((s) => s.health.filter((h) => h.memberId === memberId).sort((a, b) => a.date.localeCompare(b.date)))
  const addHealthRecord = useStore((s) => s.addHealthRecord)
  const removeHealthRecord = useStore((s) => s.removeHealthRecord)

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ date: new Date().toISOString().split('T')[0], height: '', weight: '' })

  const submit = () => {
    if (!form.date || !form.height || !form.weight) return
    addHealthRecord(memberId, form.date, parseFloat(form.height), parseFloat(form.weight))
    setForm({ date: new Date().toISOString().split('T')[0], height: '', weight: '' })
    setShowForm(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-700 flex items-center gap-2">📊 Theo dõi chiều cao & cân nặng</h3>
        <button onClick={() => setShowForm(!showForm)} className="text-sm bg-violet-100 text-violet-700 px-3 py-1.5 rounded-xl font-medium hover:bg-violet-200">
          + Thêm
        </button>
      </div>

      {showForm && (
        <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4 mb-4 grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Ngày</label>
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="w-full border border-gray-200 rounded-xl p-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Chiều cao (cm)</label>
            <input type="number" placeholder="120" value={form.height} onChange={(e) => setForm({ ...form, height: e.target.value })}
              className="w-full border border-gray-200 rounded-xl p-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Cân nặng (kg)</label>
            <input type="number" placeholder="25" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })}
              className="w-full border border-gray-200 rounded-xl p-2 text-sm" />
          </div>
          <div className="col-span-3 flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="text-sm text-gray-500 px-3 py-1.5 rounded-xl hover:bg-gray-100">Hủy</button>
            <button onClick={submit} className="text-sm bg-violet-600 text-white px-4 py-1.5 rounded-xl font-medium hover:bg-violet-700">Lưu</button>
          </div>
        </div>
      )}

      {health.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <p className="text-4xl mb-2">📏</p>
          <p>Chưa có dữ liệu. Thêm chỉ số đầu tiên!</p>
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={health}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} unit="cm" domain={['auto', 'auto']} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} unit="kg" domain={['auto', 'auto']} />
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <Tooltip formatter={(v: any, name: any) => [`${v}`, name === 'height' ? 'Chiều cao (cm)' : 'Cân nặng (kg)']} />
              <Legend formatter={(v) => v === 'height' ? 'Chiều cao' : 'Cân nặng'} />
              <Line yAxisId="left" type="monotone" dataKey="height" stroke="#7C3AED" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              <Line yAxisId="right" type="monotone" dataKey="weight" stroke="#F59E0B" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>

          {/* Data table */}
          <div className="mt-3 space-y-2">
            {[...health].reverse().slice(0, 5).map((h) => (
              <div key={h.id} className="flex items-center justify-between text-sm bg-gray-50 rounded-xl px-3 py-2">
                <span className="text-gray-500">{h.date}</span>
                <span className="font-medium">📏 {h.height} cm</span>
                <span className="font-medium">⚖️ {h.weight} kg</span>
                <button onClick={() => removeHealthRecord(h.id)} className="text-gray-300 hover:text-red-400 text-xs">✕</button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
