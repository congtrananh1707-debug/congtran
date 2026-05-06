import { useStore } from '../../store/useStore'
import type { AppView } from '../../types'
import type { Member } from '../../types'

const NAV_ITEMS: { view: AppView; icon: string; label: string }[] = [
  { view: 'dashboard', icon: '🏠',  label: 'Trang chủ'        },
  { view: 'profiles',  icon: '👨‍👩‍👧', label: 'Thành viên'        },
  { view: 'quests',    icon: '⚔️',  label: 'Nhiệm vụ'          },
  { view: 'rewards',   icon: '🎁',  label: 'Phần thưởng'       },
  { view: 'mailbox',   icon: '✉️',  label: 'Hộp thư bí mật'   },
  { view: 'gratitude', icon: '💛',  label: 'Bức tường biết ơn' },
  { view: 'wheel',     icon: '🎡',  label: 'Vòng quay may mắn' },
  { view: 'quiz',      icon: '🧠',  label: 'Đố vui gia đình'   },
  { view: 'memory',    icon: '📸',  label: 'Album kỷ niệm'     },
  { view: 'english',   icon: '🇬🇧', label: 'English Adventure' },
  { view: 'calendar',  icon: '📅',  label: 'Lịch gia đình'     },
  { view: 'heroes',    icon: '🦸',  label: 'Anh hùng thầm lặng'},
  { view: 'settings',  icon: '⚙️',  label: 'Cài đặt'           },
]

type Props = {
  view: AppView
  setView: (v: AppView) => void
  me?: Member
  logout: () => void
}

export default function Sidebar({ view, setView, me, logout }: Props) {
  const appName = useStore((s) => s.appName)

  return (
    <aside className="w-64 h-full bg-white dark:bg-gray-800 border-r border-gray-100 dark:border-gray-700 flex flex-col shadow-sm">
      {/* Logo */}
      <div className="p-5 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🏠</span>
          <div>
            <p className="font-bold text-gray-800 dark:text-white text-lg leading-tight">{appName}</p>
            <p className="text-xs text-gray-400">Không gian gia đình</p>
          </div>
        </div>
      </div>

      {/* Current user */}
      {me && (
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700 rounded-2xl p-3">
            <div className={`w-10 h-10 rounded-full ${me.color} flex items-center justify-center text-xl shadow`}>{me.emoji}</div>
            <div>
              <p className="font-semibold text-gray-800 dark:text-white text-sm">{me.name}</p>
              {me.role === 'child' && <p className="text-xs text-amber-600 font-medium">🪙 {me.tokens} xu</p>}
              {(me.role === 'dad' || me.role === 'mom') && <p className="text-xs text-violet-500">Phụ huynh</p>}
            </div>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 px-3">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.view}
            onClick={() => setView(item.view)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl mb-0.5 text-sm font-medium transition-all text-left ${
              view === item.view
                ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <span className="text-lg">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-gray-100 dark:border-gray-700">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 transition-all"
        >
          <span className="text-lg">🚪</span> Đổi thành viên
        </button>
      </div>
    </aside>
  )
}
