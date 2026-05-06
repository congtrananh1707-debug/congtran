import { useState, useRef } from 'react'
import { useStore } from '../../store/useStore'

export default function Settings() {
  const pin          = useStore((s) => s.pin)
  const setPin       = useStore((s) => s.setPin)
  const parentPin    = useStore((s) => s.parentPin)
  const setParentPin = useStore((s) => s.setParentPin)
  const logout       = useStore((s) => s.logout)
  const currentMemberId = useStore((s) => s.currentMemberId)
  const members      = useStore((s) => s.members)
  const appName      = useStore((s) => s.appName)
  const setAppName   = useStore((s) => s.setAppName)
  const bgImage      = useStore((s) => s.bgImage)
  const setBgImage   = useStore((s) => s.setBgImage)
  const darkMode     = useStore((s) => s.darkMode)
  const setDarkMode  = useStore((s) => s.setDarkMode)

  const me = members.find((m) => m.id === currentMemberId)
  const isParent = me?.role === 'dad' || me?.role === 'mom'

  // Family PIN
  const [newPin, setNewPin]       = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [pinMsg, setPinMsg]       = useState('')

  // Parent PIN
  const [newParentPin, setNewParentPin]     = useState('')
  const [confirmParentPin, setConfirmParentPin] = useState('')
  const [parentPinMsg, setParentPinMsg]    = useState('')

  // App name
  const [nameInput, setNameInput] = useState(appName)
  const [nameMsg, setNameMsg]     = useState('')

  // Background image
  const [bgUrl, setBgUrl]   = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const filterDigits = (v: string) => v.replace(/\D/g, '').slice(0, 8)

  const changePin = () => {
    if (newPin.length < 4)  { setPinMsg('PIN phải có 4–8 chữ số!'); return }
    if (!/^\d+$/.test(newPin)) { setPinMsg('PIN chỉ được chứa số 0-9!'); return }
    if (newPin !== confirmPin) { setPinMsg('Mã PIN không khớp!'); return }
    setPin(newPin)
    setNewPin(''); setConfirmPin('')
    setPinMsg('✅ Đổi PIN thành công!')
    setTimeout(() => setPinMsg(''), 3000)
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

  const handleBgFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 3 * 1024 * 1024) { alert('Ảnh quá lớn! Tối đa 3MB'); return }
    const reader = new FileReader()
    reader.onload = (ev) => setBgImage(ev.target?.result as string)
    reader.readAsDataURL(file)
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
              {pinMsg && <p className={`text-sm ${pinMsg.startsWith('✅') ? 'text-emerald-600' : 'text-red-500'}`}>{pinMsg}</p>}
              <button onClick={changePin} className="bg-violet-600 text-white px-5 py-2.5 rounded-xl font-medium text-sm hover:bg-violet-700">
                Đổi PIN
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
            {`let d=JSON.parse(localStorage.getItem('family-hub-v1')||'{}');d.state={...d.state,pin:'1234'};localStorage.setItem('family-hub-v1',JSON.stringify(d));location.reload()`}
          </code>
          <p className="mt-1">3. PIN sẽ được reset về <strong>1234</strong></p>
        </div>
      </details>

      {/* Logout */}
      <button onClick={logout} className="w-full bg-red-50 dark:bg-red-900/30 hover:bg-red-100 text-red-600 py-3.5 rounded-2xl font-medium transition-all">
        🚪 Đổi thành viên / Đăng xuất
      </button>
    </div>
  )
}
