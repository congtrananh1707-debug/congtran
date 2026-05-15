import { useState, useEffect } from 'react'
import type { AppView } from '../../types'
import Sidebar from './Sidebar'
import MobileTabBar from './MobileTabBar'
import SyncStatusBar from '../ui/SyncStatusBar'
import { useStore } from '../../store/useStore'

type Props = {
  children: React.ReactNode
  view: AppView
  setView: (v: AppView) => void
  profileId?: string
  setProfileId: (id: string) => void
}

export default function AppLayout({ children, view, setView, setProfileId }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const currentMemberId = useStore((s) => s.currentMemberId)
  const members  = useStore((s) => s.members)
  const logout   = useStore((s) => s.logout)
  const appName  = useStore((s) => s.appName)
  const bgImage  = useStore((s) => s.bgImage)
  const darkMode = useStore((s) => s.darkMode)
  const me = members.find((m) => m.id === currentMemberId)

  // Apply / remove dark class on <html>
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  const navigate = (v: AppView) => { setView(v); setSidebarOpen(false) }

  return (
    <div
      className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-900"
      style={bgImage ? { backgroundImage: `url(${bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
    >
      {/* Overlay so content remains readable over background image */}
      {bgImage && <div className="absolute inset-0 bg-white/60 dark:bg-black/60 pointer-events-none z-0" />}

      {/* Desktop Sidebar */}
      <div className="hidden lg:flex relative z-10">
        <Sidebar view={view} setView={navigate} me={me} logout={logout} />
      </div>

      {/* Mobile Sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 z-50">
            <Sidebar view={view} setView={navigate} me={me} logout={logout} />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white/90 dark:bg-gray-800/90 backdrop-blur border-b border-gray-100 dark:border-gray-700 shadow-sm">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700">
            <span className="text-xl">☰</span>
          </button>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🏠</span>
            <span className="font-bold text-gray-800 dark:text-white text-lg">{appName}</span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <SyncStatusBar />
            {me && (
              <button onClick={() => { navigate('profile'); setProfileId(me.id) }} className="flex items-center gap-2">
                <div className={`w-9 h-9 rounded-full ${me.color} flex items-center justify-center text-lg shadow overflow-hidden`}>
                  {me.avatarUrl
                    ? <img src={me.avatarUrl} alt={me.name} className="w-full h-full object-cover" />
                    : <span>{me.emoji}</span>}
                </div>
              </button>
            )}
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto pb-20 lg:pb-0 dark:text-white">
          {children}
        </main>

        {/* Mobile bottom tab bar */}
        <div className="lg:hidden relative z-10">
          <MobileTabBar view={view} setView={navigate} />
        </div>
      </div>
    </div>
  )
}
