import { useState } from 'react'
import { useSyncStore } from '../../store/useSyncStore'
import { useStore } from '../../store/useStore'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import { pushToSupabase, loadFromSupabase } from '../../hooks/useSupabaseSync'

function timeAgo(ms: number): string {
  if (ms === 0) return ''
  const sec = Math.floor((Date.now() - ms) / 1000)
  if (sec < 5)  return 'vừa xong'
  if (sec < 60) return `${sec}s trước`
  return `${Math.floor(sec / 60)}p trước`
}

export default function SyncStatusBar() {
  const { status, lastSyncAt, errorMsg, channelConnected } = useSyncStore()
  const familyCode = useStore((s) => s.familyCode)
  const [showErrorDetail, setShowErrorDetail] = useState(false)
  const [retrying, setRetrying] = useState(false)

  if (!isSupabaseConfigured) return null

  const handleRetry = async () => {
    if (!supabase || !familyCode || retrying) return
    setRetrying(true)
    try {
      await loadFromSupabase(familyCode)
      await pushToSupabase(familyCode)
    } finally {
      setRetrying(false)
      setShowErrorDetail(false)
    }
  }

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
      <>
        <button
          onClick={() => setShowErrorDetail(true)}
          className="flex items-center gap-1.5 text-xs font-medium text-red-500 dark:text-red-400 cursor-pointer"
        >
          <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
          <span>Lỗi sync</span>
        </button>
        {showErrorDetail && (
          <div
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowErrorDetail(false)}
          >
            <div
              className="bg-white dark:bg-gray-800 rounded-2xl p-5 max-w-md w-full shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="w-3 h-3 rounded-full bg-red-500" />
                <h3 className="font-bold text-gray-900 dark:text-gray-100">Lỗi đồng bộ</h3>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 break-words mb-4 font-mono bg-gray-100 dark:bg-gray-900 p-3 rounded-lg">
                {errorMsg || 'Không rõ lỗi'}
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowErrorDetail(false)}
                  className="px-4 py-2 text-sm rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  Đóng
                </button>
                <button
                  onClick={handleRetry}
                  disabled={retrying}
                  className="px-4 py-2 text-sm rounded-lg bg-violet-600 text-white font-medium hover:bg-violet-700 disabled:opacity-50"
                >
                  {retrying ? 'Đang thử lại...' : 'Thử lại'}
                </button>
              </div>
            </div>
          </div>
        )}
      </>
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
