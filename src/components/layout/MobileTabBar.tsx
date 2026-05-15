import type { AppView } from '../../types'

const TABS: { view: AppView; icon: string; label: string }[] = [
  { view: 'dashboard', icon: '🏠',  label: 'Nhà'      },
  { view: 'todos',     icon: '📋',  label: 'Việc'     },
  { view: 'games',     icon: '🎮',  label: 'Chơi'     },
  { view: 'heritage',  icon: '🏛️', label: 'Gia phả'  },
  { view: 'profiles',  icon: '👨‍👩‍👧', label: 'Gia đình' },
]

type Props = { view: AppView; setView: (v: AppView) => void }

export default function MobileTabBar({ view, setView }: Props) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-gray-800/95 backdrop-blur border-t border-gray-100 dark:border-gray-700 shadow-lg z-30">
      <div className="flex">
        {TABS.map((t) => (
          <button
            key={t.view}
            onClick={() => setView(t.view)}
            className={`flex-1 flex flex-col items-center py-2 gap-0.5 transition-all ${
              view === t.view ? 'text-violet-600 dark:text-violet-400' : 'text-gray-400 dark:text-gray-500'
            }`}
          >
            <span className={`text-2xl transition-transform ${view === t.view ? 'scale-110' : ''}`}>{t.icon}</span>
            <span className="text-xs font-medium">{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
