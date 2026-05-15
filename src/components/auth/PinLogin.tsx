import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../../store/useStore'
import { isSupabaseConfigured } from '../../lib/supabase'
import { registerFamilyPin, checkFamilyExists } from '../../hooks/useSupabaseSync'

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫']

export default function PinLogin() {
  const [input, setInput]       = useState('')
  const [shake, setShake]       = useState(false)
  const [success, setSuccess]   = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [syncing, setSyncing]   = useState(false)

  const verifyPin = useStore((s) => s.verifyPin)
  const setPin    = useStore((s) => s.setPin)       // updates pin + familyCode = fam-${pin}
  const pin       = useStore((s) => s.pin)
  const appName   = useStore((s) => s.appName)
  const familyCode = useStore((s) => s.familyCode)
  const pinLen    = pin.length

  const press = (k: string) => {
    if (k === '⌫') { setInput((p) => p.slice(0, -1)); setErrorMsg(''); return }
    if (k === '') return
    if (input.length >= 8) return
    setInput((p) => p + k)
    setErrorMsg('')
  }

  const submit = async () => {
    if (input.length === 0) return

    // ── Case 1: PIN matches local store ──────────────────────────────────────
    const ok = verifyPin(input)   // sets isAuthenticated=true + familyCode=fam-${input}
    if (ok) {
      if (isSupabaseConfigured) {
        // Register family so other devices can confirm this PIN exists
        registerFamilyPin(`fam-${input}`, input, appName).catch(console.error)
      }
      setSuccess(true)
      return
    }

    // ── Case 2: New device — PIN not in local store yet ───────────────────────
    // familyCode is always deterministic: fam-${pin}, no DB lookup for the code.
    // We only need to verify the family EXISTS in Supabase before trusting the PIN.
    if (!isSupabaseConfigured) {
      setShake(true)
      setErrorMsg('Mã PIN không đúng, thử lại!')
      setTimeout(() => { setShake(false); setInput('') }, 600)
      return
    }

    setSyncing(true)
    try {
      const exists = await checkFamilyExists(input)
      if (exists) {
        // Family confirmed in Supabase. Set local PIN → familyCode = fam-${input}
        setPin(input)          // store: pin = input, familyCode = fam-${input}
        verifyPin(input)       // now succeeds → isAuthenticated = true
        // useSupabaseSync will start (isAuthenticated just became true) and
        // do a full load from fam-${input} partition automatically.
        setSuccess(true)
      } else {
        setShake(true)
        setErrorMsg('Mã PIN không đúng, thử lại!')
        setTimeout(() => { setShake(false); setInput('') }, 600)
      }
    } catch {
      setShake(true)
      setErrorMsg('Không có mạng — thử lại sau!')
      setTimeout(() => { setShake(false); setInput('') }, 600)
    } finally {
      setSyncing(false)
    }
  }

  const canSubmit = input.length >= 4

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 flex flex-col items-center justify-center p-6">
      {/* Logo */}
      <motion.div initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-center mb-10">
        <div className="text-7xl mb-3">🏠</div>
        <h1 className="text-4xl font-bold text-white">{appName}</h1>
        <p className="text-purple-200 mt-2 text-lg">Không gian riêng của gia đình</p>
      </motion.div>

      {/* PIN dots */}
      <motion.div
        animate={shake ? { x: [-12, 12, -12, 12, 0] } : {}}
        transition={{ duration: 0.4 }}
        className="flex gap-3 mb-3 min-h-[28px] items-center justify-center"
      >
        {input.length === 0 ? (
          <div className="flex gap-3">
            {Array.from({ length: Math.max(4, pinLen) }).map((_, i) => (
              <div key={i} className="w-4 h-4 rounded-full border-2 border-purple-300 bg-transparent" />
            ))}
          </div>
        ) : (
          Array.from({ length: input.length }).map((_, i) => (
            <motion.div key={i} initial={{ scale: 0 }} animate={{ scale: 1 }}
              className="w-4 h-4 rounded-full bg-white border-2 border-white" />
          ))
        )}
      </motion.div>

      {errorMsg && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-red-300 text-sm mb-3">
          {errorMsg}
        </motion.p>
      )}
      {!errorMsg && <div className="mb-3 h-5" />}

      {/* Keypad */}
      <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}
        className="grid grid-cols-3 gap-3 w-72 mb-4"
      >
        {DIGITS.map((k, i) => (
          <button key={i} onClick={() => press(k)} disabled={k === ''}
            className={`h-16 rounded-2xl text-xl font-bold transition-all active:scale-95 ${
              k === '' ? 'opacity-0 cursor-default'
              : k === '⌫' ? 'bg-white/10 text-white hover:bg-white/20'
              : 'bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm'
            }`}>
            {k}
          </button>
        ))}
      </motion.div>

      {syncing && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="text-purple-200 text-sm mb-2 text-center"
        >
          🔄 Đang kết nối gia đình...
        </motion.p>
      )}
      {!syncing && <div className="mb-2 h-5" />}

      {/* Confirm */}
      <motion.button
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: canSubmit && !syncing ? 1 : 0.4, y: 0 }}
        onClick={submit}
        disabled={!canSubmit || syncing}
        className="w-72 h-14 bg-white text-violet-700 font-bold text-lg rounded-2xl shadow-lg hover:bg-violet-50 transition-all active:scale-95 disabled:cursor-not-allowed"
      >
        {syncing ? '...' : '✓ Xác nhận'}
      </motion.button>

      {/* Forgot PIN */}
      <motion.details initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
        className="mt-10 text-center cursor-pointer"
      >
        <summary className="text-purple-300 text-xs select-none">Quên mã PIN?</summary>
        <div className="mt-2 bg-white/10 rounded-xl p-3 text-xs text-purple-200 text-left max-w-xs leading-relaxed">
          <p className="font-semibold mb-1">Cách reset mã PIN:</p>
          <p>1. Nhấn <strong>F12</strong> → tab <strong>Console</strong></p>
          <p>2. Dán lệnh sau rồi nhấn Enter:</p>
          <code className="block mt-1 bg-black/30 rounded p-2 text-green-300 text-xs break-all select-all">
            {`let d=JSON.parse(localStorage.getItem('family-hub-v1')||'{}');d.state={...d.state,pin:'1234',familyCode:'fam-1234'};localStorage.setItem('family-hub-v1',JSON.stringify(d));location.reload()`}
          </code>
          <p className="mt-1">3. PIN sẽ được reset về <strong>1234</strong></p>
        </div>
      </motion.details>

      <AnimatePresence>
        {success && (
          <motion.div initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 bg-violet-600 flex items-center justify-center z-50"
          >
            <div className="text-center text-white">
              <div className="text-8xl mb-4">✅</div>
              <p className="text-2xl font-bold">Chào mừng về nhà!</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
