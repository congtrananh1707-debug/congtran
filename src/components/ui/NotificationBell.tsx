import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../../store/useStore'
import type { AppView, NotifKind } from '../../types'

const VIEW_FOR_KIND: Record<NotifKind, AppView> = {
  quest: 'quests',
  todo:  'todos',
  mail:  'mailbox',
}

const TIME_AGO = (ts: number): string => {
  const sec = Math.floor((Date.now() - ts) / 1000)
  if (sec < 60)   return 'vừa xong'
  const m = Math.floor(sec / 60)
  if (m < 60)     return `${m} phút trước`
  const h = Math.floor(m / 60)
  if (h < 24)     return `${h} giờ trước`
  const d = Math.floor(h / 24)
  return `${d} ngày trước`
}

export default function NotificationBell({ setView }: { setView: (v: AppView) => void }) {
  const currentMemberId  = useStore((s) => s.currentMemberId)
  const notifications    = useStore((s) => s.notifications)
  const markNotifRead    = useStore((s) => s.markNotifRead)
  const markAllNotifsRead = useStore((s) => s.markAllNotifsRead)
  const clearNotifs      = useStore((s) => s.clearNotifs)

  const myNotifs = notifications
    .filter((n) => n.recipientId === currentMemberId)
    .sort((a, b) => b.createdAt - a.createdAt)
  const unread = myNotifs.filter((n) => !n.readAt).length

  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  // Close when clicking outside
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', onClick)
    return () => window.removeEventListener('mousedown', onClick)
  }, [open])

  const handleClick = (id: string, kind: NotifKind) => {
    markNotifRead(id)
    setOpen(false)
    setView(VIEW_FOR_KIND[kind])
  }

  if (!currentMemberId) return null

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        title="Thông báo"
      >
        <span className="text-xl">🔔</span>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-80 sm:w-96 max-h-[28rem] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden z-50 flex flex-col"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
              <p className="font-bold text-gray-800 dark:text-white text-sm">Thông báo</p>
              <div className="flex gap-2 text-xs">
                {unread > 0 && (
                  <button
                    onClick={() => markAllNotifsRead(currentMemberId)}
                    className="text-violet-600 hover:underline"
                  >
                    Đọc hết
                  </button>
                )}
                {myNotifs.length > 0 && (
                  <button
                    onClick={() => clearNotifs(currentMemberId)}
                    className="text-gray-400 hover:text-red-500"
                  >
                    Xóa hết
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-y-auto flex-1">
              {myNotifs.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <p className="text-4xl mb-2">📭</p>
                  <p className="text-sm">Chưa có thông báo</p>
                </div>
              ) : (
                myNotifs.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n.id, n.kind)}
                    className={`w-full text-left px-4 py-3 border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                      !n.readAt ? 'bg-violet-50/50 dark:bg-violet-900/10' : ''
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {!n.readAt && <span className="w-2 h-2 rounded-full bg-violet-500 mt-2 flex-shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${!n.readAt ? 'font-semibold text-gray-800 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                          {n.title}
                        </p>
                        {n.body && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{n.body}</p>}
                        <p className="text-[11px] text-gray-400 mt-0.5">{TIME_AGO(n.createdAt)}</p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
