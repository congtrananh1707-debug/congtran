import { useState, useRef, useCallback } from 'react'
import { useStore } from '../../store/useStore'
import { isParentRole } from '../../types'
import { isSupabaseConfigured } from '../../lib/supabase'
import { pushToSupabase, registerFamilyPin, deletePartition, listPartitions } from '../../hooks/useSupabaseSync'
import type { PartitionInfo } from '../../hooks/useSupabaseSync'
import { compressImage } from '../../utils/image'

export default function Settings() {
  const pin             = useStore((s) => s.pin)
  const setPin          = useStore((s) => s.setPin)
  const parentPin       = useStore((s) => s.parentPin)
  const setParentPin    = useStore((s) => s.setParentPin)
  const logout          = useStore((s) => s.logout)
  const currentMemberId = useStore((s) => s.currentMemberId)
  const members         = useStore((s) => s.members)
  const appName         = useStore((s) => s.appName)
  const setAppName      = useStore((s) => s.setAppName)
  const bgImage         = useStore((s) => s.bgImage)
  const setBgImage      = useStore((s) => s.setBgImage)
  const darkMode        = useStore((s) => s.darkMode)
  const setDarkMode     = useStore((s) => s.setDarkMode)
  const familyCode      = useStore((s) => s.familyCode)
  const familyName      = useStore((s) => s.familyName)
  const setFamilyName   = useStore((s) => s.setFamilyName)
  const lastPushAt      = useStore((s) => s.lastPushAt)
  const gameRewards     = useStore((s) => s.gameRewards)
  const setGameRewards  = useStore((s) => s.setGameRewards)
  const resetGameRewards= useStore((s) => s.resetGameRewards)

  const me = members.find((m) => m.id === currentMemberId)
  const isParent = me ? isParentRole(me.role) : false

  // Family PIN
  const [newPin, setNewPin]         = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [pinMsg, setPinMsg]         = useState('')
  const [migrating, setMigrating]   = useState(false)

  // Parent PIN
  const [newParentPin, setNewParentPin]     = useState('')
  const [confirmParentPin, setConfirmParentPin] = useState('')
  const [parentPinMsg, setParentPinMsg]    = useState('')

  // App name
  const [nameInput, setNameInput] = useState(appName)
  const [nameMsg, setNameMsg]     = useState('')

  // Family name
  const [familyNameInput, setFamilyNameInput] = useState(familyName)
  const [familyNameMsg, setFamilyNameMsg]     = useState('')

  // Sync
  const [syncMsg, setSyncMsg] = useState('')

  // Hard reset
  const [resetting, setResetting] = useState(false)

  const resetAll = async () => {
    const step1 = window.confirm(
      '⚠️ XÓA TOÀN BỘ DỮ LIỆU?\n\n' +
      'Thao tác này sẽ:\n' +
      '• Xóa TẤT CẢ data trên Supabase (partition hiện tại)\n' +
      '• Xóa TẤT CẢ data trên thiết bị này\n' +
      '• Đưa app về trạng thái cài đặt mới\n\n' +
      'KHÔNG THỂ HOÀN TÁC!'
    )
    if (!step1) return

    const step2 = window.confirm('Bạn chắc chắn 100%? Nhấn OK để xóa.')
    if (!step2) return

    setResetting(true)
    try {
      // 1. Wipe Supabase partition
      if (isSupabaseConfigured) {
        await deletePartition(familyCode)
      }
    } catch { /* ignore network errors — still clear local */ } finally {
      // 2. Clear every localStorage key this app uses
      localStorage.removeItem('family-hub-v1')
      localStorage.removeItem('family-hub-pending-deletes')
      // 3. Reload to fresh state
      window.location.reload()
    }
  }

  // Partition cleanup
  const [partitions, setPartitions]       = useState<PartitionInfo[] | null>(null)
  const [scanLoading, setScanLoading]     = useState(false)
  const [deletingCode, setDeletingCode]   = useState<string | null>(null)
  const [cleanupMsg, setCleanupMsg]       = useState('')

  const scanPartitions = useCallback(async () => {
    setScanLoading(true)
    setCleanupMsg('')
    const list = await listPartitions()
    setPartitions(list)
    setScanLoading(false)
    if (list.length <= 1) setCleanupMsg('✅ Chỉ có 1 partition — không cần dọn dẹp!')
  }, [])

  const handleDeletePartition = useCallback(async (code: string) => {
    if (!window.confirm(
      `Xóa TOÀN BỘ dữ liệu của partition:\n${code}\n\nThao tác này KHÔNG thể hoàn tác!`
    )) return
    setDeletingCode(code)
    setCleanupMsg(`🔄 Đang xóa ${code}...`)
    const { ok, errors } = await deletePartition(code)
    setDeletingCode(null)
    if (ok) {
      setPartitions((prev) => prev?.filter((p) => p.familyCode !== code) ?? null)
      setCleanupMsg(`✅ Đã xóa ${code}`)
    } else {
      setCleanupMsg(`❌ Lỗi: ${errors[0] ?? 'Không xác định'}`)
    }
    setTimeout(() => setCleanupMsg(''), 5000)
  }, [])

  // Background image
  const [bgUrl, setBgUrl]   = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const filterDigits = (v: string) => v.replace(/\D/g, '').slice(0, 8)

  const changePin = () => {
    if (newPin.length < 4)     { setPinMsg('PIN phải có 4–8 chữ số!'); return }
    if (!/^\d+$/.test(newPin)) { setPinMsg('PIN chỉ được chứa số 0-9!'); return }
    if (newPin !== confirmPin)  { setPinMsg('Mã PIN không khớp!'); return }
    if (newPin === pin)         { setPinMsg('PIN mới phải khác PIN cũ!'); return }

    // Capture old partition BEFORE overwriting familyCode
    const oldFamilyCode = familyCode
    const captured      = newPin

    // Switch locally first (optimistic)
    setPin(captured)
    setNewPin(''); setConfirmPin('')

    if (!isSupabaseConfigured) {
      setPinMsg('✅ Đổi PIN thành công!')
      setTimeout(() => setPinMsg(''), 4000)
      return
    }

    setMigrating(true)
    setPinMsg('🔄 Bước 1/3 — Sao chép dữ liệu sang partition mới...')

    pushToSupabase(`fam-${captured}`)
      .then(() => {
        setPinMsg('🔄 Bước 2/3 — Đăng ký PIN mới...')
        return registerFamilyPin(`fam-${captured}`, captured, appName)
      })
      .then(() => {
        setPinMsg('🔄 Bước 3/3 — Xóa partition cũ...')
        return deletePartition(oldFamilyCode)
      })
      .then(({ ok, errors }) => {
        if (ok) {
          setPinMsg('✅ Hoàn tất! PIN mới đã kích hoạt, partition cũ đã xóa. Thiết bị khác cần nhập PIN mới để đồng bộ.')
        } else {
          // Data is safe in new partition, but old partition cleanup had errors
          setPinMsg(`⚠️ Dữ liệu đã chuyển sang PIN mới, nhưng xóa partition cũ có lỗi (${errors[0] ?? ''}). Partition cũ sẽ bị cô lập.`)
        }
        setTimeout(() => setPinMsg(''), 10000)
      })
      .catch((err: any) => {
        setPinMsg(`❌ Lỗi: ${err?.message ?? 'Không xác định'}. Dữ liệu cục bộ đã đổi PIN, nhưng Supabase chưa cập nhật.`)
        setTimeout(() => setPinMsg(''), 8000)
      })
      .finally(() => setMigrating(false))
  }

  const changeParentPin = () => {
    if (newParentPin === '') {
      setParentPin('')
      setParentPinMsg('✅ Đã tắt khóa phụ huynh!')
      setTimeout(() => setParentPinMsg(''), 3000)
      return
    }
    if (newParentPin.length < 4) { setParentPinMsg('PIN phụ huynh phải 4–8 số!'); return }
    if (newParentPin !== confirmParentPin) { setParentPinMsg('PIN không khớp!'); return }
    setParentPin(newParentPin)
    setNewParentPin(''); setConfirmParentPin('')
    setParentPinMsg('✅ Đã đặt PIN phụ huynh!')
    setTimeout(() => setParentPinMsg(''), 3000)
  }

  const saveName = () => {
    if (!nameInput.trim()) return
    setAppName(nameInput.trim())
    setNameMsg('✅ Đã lưu!')
    setTimeout(() => setNameMsg(''), 2000)
  }

  const saveFamilyName = () => {
    if (!familyNameInput.trim()) return
    setFamilyName(familyNameInput.trim())
    if (isSupabaseConfigured) {
      registerFamilyPin(familyCode, pin, familyNameInput.trim()).catch(console.error)
    }
    setFamilyNameMsg('✅ Đã lưu!')
    setTimeout(() => setFamilyNameMsg(''), 2000)
  }

  const manualSync = async () => {
    if (!isSupabaseConfigured) return
    setSyncMsg('🔄 Đang đồng bộ...')
    try {
      const { ok, errors } = await pushToSupabase(familyCode)
      setSyncMsg(ok ? '✅ Đồng bộ thành công!' : `⚠️ ${errors[0] ?? 'Lỗi không xác định'}`)
    } catch {
      setSyncMsg('❌ Không thể kết nối Supabase')
    }
    setTimeout(() => setSyncMsg(''), 4000)
  }

  const handleBgFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      // Background: 1920 px max so it looks good on large screens at lower quality
      const dataUrl = await compressImage(file, { maxPx: 1920, quality: 0.70 })
      setBgImage(dataUrl)
    } catch (err: any) {
      alert(err?.message ?? 'Không thể xử lý ảnh, thử lại!')
    }
  }

  const handleBgUrl = () => {
    if (bgUrl.trim()) { setBgImage(bgUrl.trim()); setBgUrl('') }
  }

  return (
    <div className="p-4 lg:p-6 max-w-xl mx-auto space-y-4 pb-10">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-1">⚙️ Cài đặt</h1>

      {/* Dark Mode */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{darkMode ? '🌙' : '☀️'}</span>
            <div>
              <p className="font-bold text-gray-700 dark:text-gray-200">Chế độ tối</p>
              <p className="text-xs text-gray-400">{darkMode ? 'Đang bật — bảo vệ mắt buổi tối' : 'Đang tắt — giao diện sáng'}</p>
            </div>
          </div>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className={`w-14 h-7 rounded-full transition-all relative ${darkMode ? 'bg-violet-600' : 'bg-gray-300'}`}
          >
            <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-all ${darkMode ? 'left-7' : 'left-0.5'}`} />
          </button>
        </div>
      </div>

      {/* App info */}
      <div className="bg-gradient-to-br from-violet-500 to-indigo-600 text-white rounded-3xl p-5 text-center">
        <div className="text-5xl mb-2">🏠</div>
        <h2 className="text-xl font-bold">{appName}</h2>
        <p className="text-violet-200 text-sm mt-1">Không gian riêng của gia đình bạn</p>
        <p className="text-violet-300 text-xs mt-2">v2.0.0 · Dữ liệu lưu cục bộ</p>
      </div>

      {isParent && (
        <>
          {/* Game Rewards — per-completion bonus, one knob per game */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-3xl p-5 shadow-sm border border-amber-200 dark:border-amber-700">
            <div className="flex items-start justify-between mb-1">
              <h3 className="font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2">🎮 Thưởng xu khi chơi xong</h3>
              <button
                onClick={() => { if (window.confirm('Khôi phục về mặc định 10 xu cho mỗi ván?')) resetGameRewards() }}
                className="text-xs text-amber-700 dark:text-amber-300 hover:underline"
              >
                ↺ Mặc định
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Mỗi <strong>ván hoàn thành</strong> con được số xu này. Đặt <strong>0</strong> để tắt thưởng cho 1 trò bất kỳ.
            </p>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🧠</span>
                <div className="flex-1">
                  <label className="text-xs text-gray-500 dark:text-gray-400 block">Tìm cặp giống nhau</label>
                  <p className="text-[11px] text-gray-400">Ghép đủ 8 cặp emoji ↔ từ tiếng Anh</p>
                </div>
                <input type="number" min={0} max={500} value={gameRewards.memoryComplete}
                  onChange={(e) => setGameRewards({ memoryComplete: Math.max(0, parseInt(e.target.value) || 0) })}
                  className="w-20 text-right border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl p-2.5 text-sm font-bold" />
                <span className="text-sm text-gray-500">🪙</span>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-2xl">⌨️</span>
                <div className="flex-1">
                  <label className="text-xs text-gray-500 dark:text-gray-400 block">Đoán từ</label>
                  <p className="text-[11px] text-gray-400">Trả lời xong 10 câu (gõ đúng từ tiếng Anh)</p>
                </div>
                <input type="number" min={0} max={500} value={gameRewards.guessComplete}
                  onChange={(e) => setGameRewards({ guessComplete: Math.max(0, parseInt(e.target.value) || 0) })}
                  className="w-20 text-right border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl p-2.5 text-sm font-bold" />
                <span className="text-sm text-gray-500">🪙</span>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-2xl">🎯</span>
                <div className="flex-1">
                  <label className="text-xs text-gray-500 dark:text-gray-400 block">Mini Quiz từ vựng (English Adventure)</label>
                  <p className="text-[11px] text-gray-400">Ghép cả 4 cặp từ ↔ nghĩa trong 1 ván</p>
                </div>
                <input type="number" min={0} max={500} value={gameRewards.vocabComplete}
                  onChange={(e) => setGameRewards({ vocabComplete: Math.max(0, parseInt(e.target.value) || 0) })}
                  className="w-20 text-right border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl p-2.5 text-sm font-bold" />
                <span className="text-sm text-gray-500">🪙</span>
              </div>
            </div>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-3">
              💡 Thay đổi áp dụng ngay. Cấu hình lưu local trên thiết bị này.
            </p>
          </div>

          {/* Family Identity */}
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-3xl p-5 shadow-sm border border-emerald-200 dark:border-emerald-700">
            <h3 className="font-bold text-gray-700 dark:text-gray-200 mb-1 flex items-center gap-2">🏡 Danh tính gia đình</h3>
            <p className="text-xs text-gray-400 mb-4">Mã gia đình dùng để kết nối các thiết bị — mọi thiết bị nhập cùng PIN sẽ dùng chung dữ liệu</p>

            {/* Family name */}
            <div className="mb-3">
              <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Tên gia đình</label>
              <div className="flex gap-2">
                <input
                  value={familyNameInput}
                  onChange={(e) => setFamilyNameInput(e.target.value)}
                  className="flex-1 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl p-3 text-sm"
                  maxLength={40}
                />
                <button onClick={saveFamilyName} className="bg-emerald-600 text-white px-4 rounded-xl font-medium text-sm hover:bg-emerald-700">Lưu</button>
              </div>
              {familyNameMsg && <p className="text-emerald-600 text-sm mt-1">{familyNameMsg}</p>}
            </div>

            {/* Family code (partition key) */}
            <div className="mb-3">
              <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Mã phân vùng Supabase</label>
              <div className="flex gap-2 items-center">
                <code className="flex-1 text-xs font-mono bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl p-3 text-violet-700 dark:text-violet-400 truncate select-all">
                  {familyCode}
                </code>
                <button
                  onClick={() => navigator.clipboard?.writeText(familyCode)}
                  className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-3 py-2 rounded-xl hover:bg-gray-200"
                >
                  📋
                </button>
              </div>
            </div>

            {/* Sync status */}
            {isSupabaseConfigured && (
              <div className="flex items-center justify-between">
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {lastPushAt > 0
                    ? `Đồng bộ lần cuối: ${new Date(lastPushAt).toLocaleTimeString('vi-VN')}`
                    : 'Chưa đồng bộ lần nào'}
                </div>
                <button
                  onClick={manualSync}
                  className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-xl hover:bg-emerald-700"
                >
                  🔄 Sync ngay
                </button>
              </div>
            )}
            {syncMsg && <p className={`text-sm mt-2 ${syncMsg.startsWith('✅') ? 'text-emerald-600' : 'text-orange-500'}`}>{syncMsg}</p>}

            {/* How to connect new device */}
            <details className="mt-4">
              <summary className="text-xs text-emerald-700 dark:text-emerald-400 cursor-pointer select-none font-medium">
                📱 Kết nối thiết bị mới?
              </summary>
              <div className="mt-2 text-xs text-gray-600 dark:text-gray-400 space-y-1 bg-white/60 dark:bg-gray-800/60 rounded-xl p-3">
                <p>1. Mở app trên thiết bị mới</p>
                <p>2. Nhập cùng mã PIN: <strong className="font-mono">{'*'.repeat(pin.length)}</strong> ({pin.length} chữ số)</p>
                <p>3. App tự động tìm gia đình trên Supabase và đồng bộ dữ liệu</p>
                {!isSupabaseConfigured && <p className="text-orange-500 mt-1">⚠️ Cần cấu hình Supabase để kết nối đa thiết bị</p>}
              </div>
            </details>

            {/* Clan connection groundwork */}
            <details className="mt-3">
              <summary className="text-xs text-teal-700 dark:text-teal-400 cursor-pointer select-none font-medium">
                🌳 Kết nối họ tộc (sắp ra mắt)
              </summary>
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 bg-white/60 dark:bg-gray-800/60 rounded-xl p-3 space-y-1">
                <p>Tính năng đang phát triển — cho phép:</p>
                <p>• Kết nối nhiều gia đình trong cùng họ tộc</p>
                <p>• Xây dựng cây gia phả chung toàn họ</p>
                <p>• Chia sẻ thông tin ngày giỗ, kỵ giữa các gia đình</p>
                <p className="text-teal-600 dark:text-teal-400 mt-1">Mã gia đình của bạn: <code className="font-mono">{familyCode.slice(0, 12)}…</code></p>
              </div>
            </details>
          </div>

          {/* App name */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
            <h3 className="font-bold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">✏️ Tên ứng dụng</h3>
            <div className="flex gap-2">
              <input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="flex-1 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl p-3 text-sm"
                maxLength={30}
              />
              <button onClick={saveName} className="bg-violet-600 text-white px-4 rounded-xl font-medium text-sm hover:bg-violet-700">Lưu</button>
            </div>
            {nameMsg && <p className="text-emerald-600 text-sm mt-2">{nameMsg}</p>}
          </div>

          {/* Background image */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
            <h3 className="font-bold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">🖼️ Ảnh nền gia đình</h3>
            {bgImage && (
              <div className="mb-3 relative">
                <img src={bgImage} alt="bg preview" className="w-full h-32 object-cover rounded-xl" />
                <button
                  onClick={() => setBgImage('')}
                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                >✕</button>
              </div>
            )}
            <div className="space-y-2">
              <input ref={fileRef} type="file" accept="image/*" onChange={handleBgFile} className="hidden" />
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-xl p-3 text-sm text-gray-500 dark:text-gray-400 hover:border-violet-400 hover:text-violet-600 transition-colors"
              >
                📁 Chọn ảnh từ thiết bị (tối đa 3MB)
              </button>
              <div className="flex gap-2">
                <input
                  value={bgUrl}
                  onChange={(e) => setBgUrl(e.target.value)}
                  placeholder="Hoặc dán link ảnh (URL)..."
                  className="flex-1 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl p-3 text-sm"
                />
                <button onClick={handleBgUrl} className="bg-violet-600 text-white px-4 rounded-xl font-medium text-sm hover:bg-violet-700">OK</button>
              </div>
            </div>
          </div>

          {/* Family PIN */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
            <h3 className="font-bold text-gray-700 dark:text-gray-200 mb-1 flex items-center gap-2">🔐 Mã PIN gia đình</h3>
            <p className="text-xs text-gray-400 mb-4">Dùng để mở khóa ứng dụng · Hiện tại: {pin.length} chữ số</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">PIN mới <span className="text-gray-300">({newPin.length}/8 ký tự)</span></label>
                <input
                  type="password"
                  value={newPin}
                  onChange={(e) => setNewPin(filterDigits(e.target.value))}
                  placeholder="4–8 chữ số..."
                  inputMode="numeric"
                  className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl p-3 text-sm"
                  maxLength={8}
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Xác nhận PIN mới</label>
                <input
                  type="password"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(filterDigits(e.target.value))}
                  placeholder="Nhập lại PIN mới..."
                  inputMode="numeric"
                  className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl p-3 text-sm"
                  maxLength={8}
                />
              </div>
              {pinMsg && (
                <p className={`text-sm ${pinMsg.startsWith('✅') ? 'text-emerald-600' : pinMsg.startsWith('🔄') ? 'text-blue-500' : 'text-red-500'}`}>
                  {pinMsg}
                </p>
              )}
              <button
                onClick={changePin}
                disabled={migrating}
                className="bg-violet-600 text-white px-5 py-2.5 rounded-xl font-medium text-sm hover:bg-violet-700 disabled:opacity-50"
              >
                {migrating ? '🔄 Đang chuyển dữ liệu...' : 'Đổi PIN'}
              </button>
            </div>
          </div>

          {/* Parent PIN */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
            <h3 className="font-bold text-gray-700 dark:text-gray-200 mb-1 flex items-center gap-2">🔒 PIN bảo vệ phụ huynh</h3>
            <p className="text-xs text-gray-400 mb-4">
              {parentPin ? `Đang bật — con cái không thể chọn tài khoản bố/mẹ mà không có PIN này` : 'Đang tắt — ai cũng có thể chọn tài khoản bố/mẹ'}
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">
                  PIN phụ huynh mới <span className="text-gray-300">({newParentPin.length}/8)</span>
                </label>
                <input
                  type="password"
                  value={newParentPin}
                  onChange={(e) => setNewParentPin(filterDigits(e.target.value))}
                  placeholder="Để trống = tắt khóa phụ huynh"
                  inputMode="numeric"
                  className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl p-3 text-sm"
                  maxLength={8}
                />
              </div>
              {newParentPin && (
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Xác nhận</label>
                  <input
                    type="password"
                    value={confirmParentPin}
                    onChange={(e) => setConfirmParentPin(filterDigits(e.target.value))}
                    placeholder="Nhập lại..."
                    inputMode="numeric"
                    className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl p-3 text-sm"
                    maxLength={8}
                  />
                </div>
              )}
              {parentPinMsg && <p className={`text-sm ${parentPinMsg.startsWith('✅') ? 'text-emerald-600' : 'text-red-500'}`}>{parentPinMsg}</p>}
              <button onClick={changeParentPin} className="bg-rose-600 text-white px-5 py-2.5 rounded-xl font-medium text-sm hover:bg-rose-700">
                {newParentPin ? 'Đặt PIN phụ huynh' : 'Tắt khóa phụ huynh'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Partition Cleanup ───────────────────────────────────────────────── */}
      {isParent && isSupabaseConfigured && (
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-start justify-between mb-1 gap-2">
            <div>
              <h3 className="font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                🗂️ Dọn dẹp phân vùng dữ liệu
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Xóa các partition cũ còn sót lại sau khi đổi PIN
              </p>
            </div>
            <button
              onClick={scanPartitions}
              disabled={scanLoading}
              className="flex-shrink-0 text-xs bg-violet-600 text-white px-3 py-1.5 rounded-xl font-medium hover:bg-violet-700 disabled:opacity-50"
            >
              {scanLoading ? '🔍 Đang quét...' : '🔍 Quét'}
            </button>
          </div>

          {cleanupMsg && (
            <p className={`text-sm mt-2 ${
              cleanupMsg.startsWith('✅') ? 'text-emerald-600'
              : cleanupMsg.startsWith('❌') ? 'text-red-500'
              : 'text-blue-500'
            }`}>{cleanupMsg}</p>
          )}

          {partitions !== null && partitions.length > 0 && (
            <div className="mt-3 space-y-2">
              {partitions.map((p) => {
                const isCurrent = p.familyCode === familyCode
                const lastSync  = p.lastPushAt > 0
                  ? new Date(p.lastPushAt).toLocaleString('vi-VN')
                  : 'Chưa rõ'
                return (
                  <div
                    key={p.familyCode}
                    className={`rounded-2xl p-3 border flex items-center gap-3 ${
                      isCurrent
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-600'
                        : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700'
                    }`}
                  >
                    <span className="text-xl flex-shrink-0">{isCurrent ? '✅' : '⚠️'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <code className="text-xs font-mono text-gray-700 dark:text-gray-300 truncate">
                          {p.familyCode}
                        </code>
                        {isCurrent && (
                          <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">
                            Đang dùng
                          </span>
                        )}
                        {!isCurrent && (
                          <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-semibold">
                            Partition cũ
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {p.memberCount} thành viên · Lần push: {lastSync}
                      </p>
                    </div>
                    {!isCurrent && (
                      <button
                        onClick={() => handleDeletePartition(p.familyCode)}
                        disabled={deletingCode === p.familyCode}
                        className="flex-shrink-0 text-xs bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-xl font-medium disabled:opacity-50"
                      >
                        {deletingCode === p.familyCode ? '⏳' : '🗑 Xóa'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {partitions !== null && partitions.length === 0 && (
            <p className="text-sm text-gray-400 mt-2">Không tìm thấy partition nào.</p>
          )}
        </div>
      )}

      {/* Supabase Sync */}
      <div className={`rounded-3xl p-5 shadow-sm border ${isSupabaseConfigured ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700' : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
        <h3 className="font-bold text-gray-700 dark:text-gray-200 mb-1 flex items-center gap-2">
          🔄 Đồng bộ đa thiết bị
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isSupabaseConfigured ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-500'}`}>
            {isSupabaseConfigured ? '🟢 Bật' : '⚪ Chưa cấu hình'}
          </span>
        </h3>

        {isSupabaseConfigured ? (
          <div className="space-y-2 mt-3 text-sm text-gray-600 dark:text-gray-400">
            <p>✅ <strong>Tự động theo mã PIN</strong> — mọi thiết bị nhập cùng một PIN sẽ đồng bộ chung dữ liệu.</p>
            <p>🔄 Dữ liệu đồng bộ realtime khi có thay đổi.</p>
            <p className="text-xs text-gray-400 pt-1 border-t border-gray-100 dark:border-gray-700">
              Partition: <code className="font-mono text-violet-600 dark:text-violet-400">{familyCode}</code>
            </p>
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Supabase chưa được cấu hình. Dữ liệu chỉ lưu trên thiết bị này.
          </p>
        )}
      </div>

      {/* Data info */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
        <h3 className="font-bold text-gray-700 dark:text-gray-200 mb-3">💾 Lưu trữ dữ liệu</h3>
        <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          {[
            ['✅', 'Dữ liệu lưu trong trình duyệt (localStorage)'],
            ['⚠️', 'Xóa cache trình duyệt sẽ mất toàn bộ dữ liệu'],
            ['💡', 'Xuất/nhập dữ liệu: tính năng đang phát triển'],
          ].map(([icon, text]) => (
            <div key={text} className="flex items-center gap-2">
              <span>{icon}</span><span>{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Usage guide */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
        <h3 className="font-bold text-gray-700 dark:text-gray-200 mb-3">📖 Hướng dẫn</h3>
        <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          {[
            ['⚔️', 'Nhiệm vụ', 'Bố/mẹ tạo → con hoàn thành → bố/mẹ duyệt → nhận xu'],
            ['🎁', 'Phần thưởng', 'Dùng xu để đổi phần thưởng'],
            ['✉️', 'Hộp thư', 'Gửi thư riêng tư, phản ứng cảm xúc'],
            ['🇬🇧', 'Tiếng Anh', 'Học từ vựng hàng ngày, luyện quiz'],
            ['📅', 'Lịch', 'Sinh nhật, sự kiện gia đình'],
            ['🦸', 'Anh hùng', 'Ghi nhận việc tốt chưa được nhắc'],
          ].map(([icon, title, desc]) => (
            <div key={title as string} className="flex gap-2">
              <span className="flex-shrink-0">{icon}</span>
              <div><span className="font-medium text-gray-700 dark:text-gray-200">{title}:</span> {desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* PIN reset guide */}
      <details className="cursor-pointer">
        <summary className="text-gray-400 text-xs select-none text-center">Quên mã PIN?</summary>
        <div className="mt-2 bg-gray-50 dark:bg-gray-700 rounded-xl p-3 text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
          <p className="font-semibold mb-1">Reset PIN về 1234:</p>
          <p>1. Nhấn <strong>F12</strong> → tab <strong>Console</strong></p>
          <p>2. Dán lệnh sau rồi nhấn Enter:</p>
          <code className="block mt-1 bg-black/20 rounded p-2 text-green-400 text-xs break-all select-all">
            {`let d=JSON.parse(localStorage.getItem('family-hub-v1')||'{}');d.state={...d.state,pin:'1234',familyCode:'fam-1234'};localStorage.setItem('family-hub-v1',JSON.stringify(d));location.reload()`}
          </code>
          <p className="mt-1">3. PIN và partition sẽ được reset về <strong>1234</strong></p>
        </div>
      </details>

      {/* ── Danger Zone ─────────────────────────────────────────────────────── */}
      {isParent && (
        <div className="border-2 border-red-200 dark:border-red-800 rounded-3xl p-5">
          <h3 className="font-bold text-red-600 dark:text-red-400 mb-1 flex items-center gap-2">
            ☢️ Vùng nguy hiểm
          </h3>
          <p className="text-xs text-red-400 mb-4">
            Các thao tác dưới đây không thể hoàn tác. Hãy chắc chắn trước khi thực hiện.
          </p>
          <button
            onClick={resetAll}
            disabled={resetting}
            className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-3 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2"
          >
            {resetting
              ? '⏳ Đang xóa toàn bộ dữ liệu...'
              : '🗑️ Reset toàn bộ — Làm lại từ đầu'}
          </button>
          <p className="text-xs text-red-400 text-center mt-2">
            Xóa data trên Supabase + localStorage → khởi động lại app sạch
          </p>
        </div>
      )}

      {/* Logout */}
      <button onClick={logout} className="w-full bg-red-50 dark:bg-red-900/30 hover:bg-red-100 text-red-600 py-3.5 rounded-2xl font-medium transition-all">
        🚪 Đổi thành viên / Đăng xuất
      </button>
    </div>
  )
}
