import { useSyncStore } from '../../store/useSyncStore'
import { isSupabaseConfigured } from '../../lib/supabase'

function timeAgo(ms: number): string {
  if (ms === 0) return ''
  const sec = Math.floor((Date.now() - ms) / 1000)
  if (sec < 5)  return 'vừa xong'
  if (sec < 60) return `${sec}s trước`
  return `${Math.floor(sec / 60)}p trước`
}

export default function SyncStatusBar() {
  const { status, lastSyncAt, errorMsg, channelConnected } = useSyncStore()

  // Don't render anything if Supabase is not configured
  if (!isSupabaseConfigured) return null

  if (status === 'offline') {
    return (
      <div className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse flex-shrink-0" />
        <span>Offline</span>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="flex items-center gap-1.5 text-xs font-medium text-red-500 dark:text-red-400" title={errorMsg}>
        <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
        <span>Lỗi sync</span>
      </div>
    )
  }

  if (status === 'syncing') {
    return (
      <div className="flex items-center gap-1.5 text-xs font-medium text-blue-500 dark:text-blue-400">
        <svg className="w-3 h-3 animate-spin flex-shrink-0" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span>Đang đồng bộ...</span>
      </div>
    )
  }

  // idle — show realtime dot + last sync time
  return (
    <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
      <span
        className={`w-2 h-2 rounded-full flex-shrink-0 ${
          channelConnected ? 'bg-emerald-400' : 'bg-gray-300 dark:bg-gray-600'
        }`}
        title={channelConnected ? 'Realtime đã kết nối' : 'Đang dùng polling'}
      />
      {lastSyncAt > 0 && <span>{timeAgo(lastSyncAt)}</span>}
    </div>
  )
}
