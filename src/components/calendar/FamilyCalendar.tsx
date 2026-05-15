import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../../store/useStore'
import { lunarToSolar } from '../../utils/lunar'

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
const MONTH_NAMES = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6',
                     'Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12']

type EventItem = {
  label: string
  color: string
  emoji: string
}

function getEventsForDay(
  year: number, month: number, day: number,
  members: ReturnType<typeof useStore.getState>['members'],
  quests: ReturnType<typeof useStore.getState>['quests'],
  calendarEvents: ReturnType<typeof useStore.getState>['calendarEvents'],
  anniversaries: ReturnType<typeof useStore.getState>['anniversaries'],
): EventItem[] {
  const mm = String(month + 1).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  const dateStr = `${year}-${mm}-${dd}`
  const events: EventItem[] = []

  // Birthdays (recurring yearly)
  members.forEach((m) => {
    if (!m.birthday) return
    const [, bm, bd] = m.birthday.split('-')
    if (bm === mm && bd === dd) {
      events.push({ label: `🎂 Sinh nhật ${m.name}`, color: 'bg-pink-500', emoji: '🎂' })
    }
  })

  // Flash quest deadlines
  quests.forEach((q) => {
    if (!q.flashDeadline) return
    const d = new Date(q.flashDeadline)
    if (d.getFullYear() === year && d.getMonth() === month && d.getDate() === day) {
      events.push({ label: `⚡ ${q.title}`, color: 'bg-orange-400', emoji: '⚡' })
    }
  })

  // Custom calendar events
  calendarEvents.forEach((e) => {
    if (e.date === dateStr) {
      events.push({ label: `${e.emoji} ${e.title}`, color: e.color || 'bg-violet-500', emoji: e.emoji })
    }
  })

  // Death anniversaries — auto-converted from lunar day/month to this
  // year's solar date so they show up on the right calendar cell every
  // year without families having to enter the date manually.
  anniversaries.forEach((ann) => {
    if (!ann.lunarDay || !ann.lunarMonth) return
    try {
      const s = lunarToSolar(ann.lunarDay, ann.lunarMonth, year, false)
      if (s.month === month + 1 && s.day === day) {
        events.push({ label: `🕯️ ${ann.name}`, color: 'bg-amber-700', emoji: '🕯️' })
      }
    } catch { /* skip invalid lunar date */ }
  })

  return events
}

export default function FamilyCalendar() {
  const members        = useStore((s) => s.members)
  const quests         = useStore((s) => s.quests)
  const calendarEvents = useStore((s) => s.calendarEvents)
  const anniversaries  = useStore((s) => s.anniversaries)
  const addCalendarEvent    = useStore((s) => s.addCalendarEvent)
  const updateCalendarEvent = useStore((s) => s.updateCalendarEvent)
  const removeCalendarEvent = useStore((s) => s.removeCalendarEvent)
  const currentMemberId    = useStore((s) => s.currentMemberId)
  const me = members.find((m) => m.id === currentMemberId)
  const isParent = me?.role === 'dad' || me?.role === 'mom'

  const today = new Date()
  const [year, setYear]   = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selectedDay, setSelectedDay] = useState<number | null>(today.getDate())
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [addDone, setAddDone] = useState(false)
  const [form, setForm] = useState({ title: '', emoji: '🎉', date: '', color: 'bg-violet-500' })

  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1); setSelectedDay(null) }
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1); setSelectedDay(null) }

  // Build calendar grid
  const firstDow = new Date(year, month, 1).getDay()  // 0=Sun, 1=Mon...
  const adjustedFirst = (firstDow + 6) % 7            // make Mon=0
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(adjustedFirst).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  // Pad to complete rows of 7
  while (cells.length % 7 !== 0) cells.push(null)

  const selectedEvents = selectedDay
    ? getEventsForDay(year, month, selectedDay, members, quests, calendarEvents, anniversaries)
    : []

  // All events this month for list view
  const monthEvents: { day: number; items: EventItem[] }[] = []
  for (let d = 1; d <= daysInMonth; d++) {
    const items = getEventsForDay(year, month, d, members, quests, calendarEvents, anniversaries)
    if (items.length > 0) monthEvents.push({ day: d, items })
  }

  const openEdit = (id: string) => {
    const ev = calendarEvents.find((e) => e.id === id)
    if (!ev) return
    setEditingId(id)
    setForm({ title: ev.title, emoji: ev.emoji, date: ev.date, color: ev.color })
    setShowAdd(true)
  }

  const addEvent = () => {
    if (!form.title.trim() || !form.date || addDone) return
    if (editingId) {
      updateCalendarEvent(editingId, { title: form.title, emoji: form.emoji, date: form.date, color: form.color })
    } else {
      addCalendarEvent({ title: form.title, emoji: form.emoji, date: form.date, color: form.color, createdBy: currentMemberId || '' })
    }
    setAddDone(true)
    setTimeout(() => {
      setForm({ title: '', emoji: '🎉', date: '', color: 'bg-violet-500' })
      setShowAdd(false); setEditingId(null); setAddDone(false)
    }, 600)
  }

  const EVENT_COLORS = ['bg-violet-500', 'bg-rose-500', 'bg-amber-500', 'bg-emerald-500', 'bg-blue-500', 'bg-pink-500']
  const EVENT_EMOJIS = ['🎉', '🎂', '🏆', '⭐', '❤️', '🌟', '🎊', '🎈', '📌', '🏖️']

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">📅 Lịch gia đình</h1>
          <p className="text-gray-500 text-sm">Sinh nhật, sự kiện và kỷ niệm</p>
        </div>
        {isParent && (
          <button onClick={() => setShowAdd(true)} className="bg-violet-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-violet-700">
            + Sự kiện
          </button>
        )}
      </div>

      {/* Add event form */}
      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 mb-5">
            <h3 className="font-bold text-gray-700 dark:text-gray-200 mb-4">{editingId ? '✏️ Sửa sự kiện' : '✨ Thêm sự kiện'}</h3>
            <div className="space-y-3">
              <div className="flex gap-2">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Icon</label>
                  <select value={form.emoji} onChange={(e) => setForm({ ...form, emoji: e.target.value })}
                    className="border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl p-2.5 text-lg">
                    {EVENT_EMOJIS.map((e) => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-400 block mb-1">Tên sự kiện</label>
                  <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="Nhập tên..." className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl p-3 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Ngày</label>
                <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl p-3 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Màu</label>
                <div className="flex gap-2">
                  {EVENT_COLORS.map((c) => (
                    <button key={c} onClick={() => setForm({ ...form, color: c })}
                      className={`w-8 h-8 rounded-full ${c} transition-transform ${form.color === c ? 'scale-125 ring-2 ring-offset-2 ring-gray-400' : ''}`} />
                  ))}
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => { setShowAdd(false); setEditingId(null) }} disabled={addDone} className="text-gray-500 px-4 py-2 rounded-xl text-sm hover:bg-gray-100 disabled:opacity-40">Hủy</button>
                <button onClick={addEvent} disabled={!form.title.trim() || !form.date || addDone} className="bg-violet-600 text-white px-4 py-2 rounded-xl font-medium text-sm hover:bg-violet-700 disabled:opacity-50 transition-all">
                  {addDone ? '✅ Đã lưu!' : editingId ? 'Lưu thay đổi' : 'Lưu'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Calendar card */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden mb-5">
        {/* Month nav */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <button onClick={prevMonth} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 text-lg">‹</button>
          <h2 className="font-bold text-gray-800 dark:text-white">{MONTH_NAMES[month]} {year}</h2>
          <button onClick={nextMonth} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 text-lg">›</button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-gray-100 dark:border-gray-700">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400">{d}</div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            if (!day) return <div key={`empty-${i}`} className="h-12 border-b border-r border-gray-50 dark:border-gray-700/50" />
            const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear()
            const isSelected = day === selectedDay
            const events = getEventsForDay(year, month, day, members, quests, calendarEvents, anniversaries)
            return (
              <button key={day} onClick={() => setSelectedDay(day === selectedDay ? null : day)}
                className={`h-12 flex flex-col items-center justify-center border-b border-r border-gray-50 dark:border-gray-700/50 text-sm transition-colors relative ${
                  isSelected ? 'bg-violet-600 text-white' :
                  isToday ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 font-bold' :
                  'hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-300'
                }`}>
                <span>{day}</span>
                {events.length > 0 && (
                  <div className="flex gap-0.5 mt-0.5">
                    {events.slice(0, 3).map((_, ei) => (
                      <span key={ei} className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-violet-400'}`} />
                    ))}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Selected day events */}
      <AnimatePresence>
        {selectedDay && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 mb-5">
            <h3 className="font-bold text-gray-700 dark:text-gray-200 mb-3">
              {selectedDay}/{month + 1}/{year}
            </h3>
            {selectedEvents.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">Không có sự kiện nào ngày này</p>
            ) : (
              <div className="space-y-2">
                {selectedEvents.map((ev, i) => {
                  // Match this event back to a user-added calendarEvent (birthdays/quests are derived, not editable)
                  const mm = String(month + 1).padStart(2, '0')
                  const dd = String(selectedDay).padStart(2, '0')
                  const dateStr = `${year}-${mm}-${dd}`
                  const userEvent = calendarEvents.find((c) => c.date === dateStr && ev.label === `${c.emoji} ${c.title}`)
                  return (
                    <div key={i} className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700 rounded-xl p-3">
                      <span className="text-xl">{ev.emoji}</span>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-200 flex-1">{ev.label}</span>
                      {isParent && userEvent && (
                        <>
                          <button onClick={() => openEdit(userEvent.id)} className="text-gray-400 hover:text-violet-500 text-sm" title="Sửa">✏️</button>
                          <button onClick={() => removeCalendarEvent(userEvent.id)} className="text-gray-400 hover:text-red-500 text-sm" title="Xóa">🗑</button>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upcoming events this month */}
      {monthEvents.length > 0 && (
        <div>
          <h3 className="font-bold text-gray-700 dark:text-gray-200 mb-3 text-sm uppercase tracking-wide">
            📋 Sự kiện tháng {month + 1}
          </h3>
          <div className="space-y-2">
            {monthEvents.map(({ day, items }) => (
              <div key={day} className="flex gap-3 bg-white dark:bg-gray-800 rounded-2xl p-3 border border-gray-100 dark:border-gray-700 shadow-sm">
                <div className="flex-shrink-0 w-10 h-10 bg-violet-100 dark:bg-violet-900/30 rounded-xl flex items-center justify-center">
                  <span className="text-sm font-bold text-violet-700 dark:text-violet-300">{day}</span>
                </div>
                <div className="flex-1 min-w-0">
                  {items.map((ev, i) => (
                    <div key={i} className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm">{ev.emoji}</span>
                      <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{ev.label}</span>
                      {isParent && ev.label.includes('🎉') || ev.label.includes('📌') ? (
                        <button onClick={() => {
                          const ceId = calendarEvents.find((e) => e.title === ev.label.replace(/^[^ ]+ /, '') && e.date.endsWith(`-${String(day).padStart(2,'0')}`))?.id
                          if (ceId) removeCalendarEvent(ceId)
                        }} className="text-gray-300 hover:text-red-400 text-xs ml-auto">🗑</button>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {monthEvents.length === 0 && !showAdd && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-5xl mb-3">📅</p>
          <p>Tháng này chưa có sự kiện</p>
          {isParent && <p className="text-sm mt-1">Nhấn "+ Sự kiện" để thêm</p>}
        </div>
      )}
    </div>
  )
}
