import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../../store/useStore'
import { shuffle } from '../../utils/helpers'
import { VOCAB_DATA } from '../../data/vocab'

type GameKey = 'memory' | 'guess'

// ─── Memory Match ───────────────────────────────────────────────────────────

type Card = {
  cardId: string       // unique per card instance
  pairId: string       // shared between the word and its emoji partner
  label: string
  flipped: boolean
  matched: boolean
}

function makeMemoryDeck(pairCount: number): Card[] {
  // Sample emoji-bearing vocab words so each card has a visual cue
  const pool = VOCAB_DATA.filter((v) => v.emoji)
  const picks = shuffle(pool).slice(0, pairCount)
  const cards: Card[] = []
  picks.forEach((w, i) => {
    cards.push({ cardId: `${i}-w`, pairId: String(i), label: w.word, flipped: false, matched: false })
    cards.push({ cardId: `${i}-e`, pairId: String(i), label: w.emoji ?? '?', flipped: false, matched: false })
  })
  return shuffle(cards)
}

function MemoryMatch({ memberId, onExit }: { memberId: string; onExit: () => void }) {
  const updateMember = useStore((s) => s.updateMember)
  const members      = useStore((s) => s.members)
  const reward       = useStore((s) => s.gameRewards.memoryComplete)
  const [pairCount] = useState(8)
  const [cards, setCards] = useState<Card[]>(() => makeMemoryDeck(pairCount))
  const [selected, setSelected] = useState<Card[]>([])
  const [moves, setMoves] = useState(0)
  const [won, setWon] = useState(false)
  const awardedRef = useRef(false)

  const award = () => {
    if (awardedRef.current || reward <= 0) return
    awardedRef.current = true
    const me = members.find((m) => m.id === memberId)
    if (me) updateMember(memberId, { tokens: me.tokens + reward })
  }

  const flip = (card: Card) => {
    if (card.matched || card.flipped || selected.length === 2) return
    const newCards = cards.map((c) => (c.cardId === card.cardId ? { ...c, flipped: true } : c))
    const newSel = [...selected, card]
    setCards(newCards)
    setSelected(newSel)
    if (newSel.length === 2) {
      setMoves((m) => m + 1)
      const [a, b] = newSel
      const isMatch = a.pairId === b.pairId
      setTimeout(() => {
        setCards((cs) =>
          cs.map((c) =>
            c.cardId === a.cardId || c.cardId === b.cardId
              ? { ...c, matched: isMatch, flipped: isMatch }
              : c,
          ),
        )
        setSelected([])
        if (isMatch) {
          // Round-complete check uses the soon-to-be-applied card list.
          const remaining = cards.filter((c) => !c.matched && c.cardId !== a.cardId && c.cardId !== b.cardId).length
          if (remaining === 0) {
            award()
            setTimeout(() => setWon(true), 350)
          }
        }
      }, 700)
    }
  }

  const restart = () => {
    setCards(makeMemoryDeck(pairCount))
    setSelected([]); setMoves(0); setWon(false)
    awardedRef.current = false
  }

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <button onClick={onExit} className="text-gray-500 hover:text-gray-700">← Quay lại</button>
        <h2 className="text-xl font-bold text-gray-800 dark:text-white">🧠 Tìm cặp giống nhau</h2>
        <span className="text-sm text-gray-500 tabular-nums">{moves} lượt</span>
      </div>

      <p className="text-sm text-center text-gray-500 mb-4">
        Mở 2 thẻ — ghép từ tiếng Anh với icon tương ứng.
        {reward > 0
          ? <> Hoàn thành ván sẽ được <strong>+{reward} 🪙</strong>.</>
          : ' (Bố mẹ đã tắt thưởng xu cho trò này.)'}
      </p>

      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        {cards.map((c) => {
          const showFace = c.flipped || c.matched
          return (
            <motion.button key={c.cardId} onClick={() => flip(c)}
              whileTap={showFace ? {} : { scale: 0.95 }}
              className={`aspect-square rounded-2xl flex items-center justify-center text-center font-bold transition-all p-1 ${
                c.matched ? 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-300' :
                c.flipped ? 'bg-white text-gray-800 shadow-md' :
                'bg-gradient-to-br from-violet-500 to-indigo-500 text-white shadow-md hover:from-violet-600'
              }`}
            >
              {showFace ? (
                <span className={c.label.length > 3 ? 'text-sm' : 'text-3xl'}>
                  {c.label}
                </span>
              ) : (
                <span className="text-2xl">❓</span>
              )}
            </motion.button>
          )
        })}
      </div>

      <AnimatePresence>
        {won && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.7 }} animate={{ scale: 1 }} className="bg-white dark:bg-gray-800 rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl">
              <div className="text-6xl mb-2">🏆</div>
              <p className="text-xl font-bold text-gray-800 dark:text-white mb-1">Hoàn thành!</p>
              <p className="text-gray-500 mb-4">{moves} lượt{reward > 0 ? ` · +${reward} 🪙` : ''}</p>
              <div className="flex gap-2 justify-center">
                <button onClick={restart} className="bg-violet-600 text-white px-5 py-2 rounded-xl font-medium hover:bg-violet-700">Chơi lại</button>
                <button onClick={onExit} className="bg-gray-100 text-gray-700 px-5 py-2 rounded-xl font-medium hover:bg-gray-200">Đóng</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Guess the Word — show emoji + Vietnamese, type the English ────────────

function GuessGame({ memberId, onExit }: { memberId: string; onExit: () => void }) {
  const updateMember = useStore((s) => s.updateMember)
  const members      = useStore((s) => s.members)
  const reward       = useStore((s) => s.gameRewards.guessComplete)
  const [pool] = useState(() => shuffle(VOCAB_DATA.filter((v) => v.emoji)).slice(0, 10))
  const [idx, setIdx] = useState(0)
  const [input, setInput] = useState('')
  const [feedback, setFeedback] = useState<'idle' | 'correct' | 'wrong'>('idle')
  const [score, setScore] = useState(0)
  const [done, setDone] = useState(false)
  const awardedRef = useRef(false)

  const word = pool[idx]

  const finish = () => {
    if (!awardedRef.current && reward > 0) {
      awardedRef.current = true
      const me = members.find((m) => m.id === memberId)
      if (me) updateMember(memberId, { tokens: me.tokens + reward })
    }
    setDone(true)
  }

  const submit = () => {
    if (!word) return
    if (input.trim().toLowerCase() === word.word.toLowerCase()) {
      setFeedback('correct')
      setScore((s) => s + 1)
      setTimeout(() => {
        setFeedback('idle'); setInput('')
        if (idx + 1 >= pool.length) finish()
        else setIdx((i) => i + 1)
      }, 700)
    } else {
      setFeedback('wrong')
      setTimeout(() => setFeedback('idle'), 600)
    }
  }

  if (done) {
    return (
      <div className="p-4 lg:p-6 max-w-md mx-auto text-center">
        <div className="text-6xl mb-3">{score >= 8 ? '🏆' : score >= 5 ? '🎉' : '💪'}</div>
        <p className="text-xl font-bold text-gray-800 dark:text-white mb-1">{score}/{pool.length} đúng</p>
        {reward > 0 && <p className="text-gray-500 mb-4">+{reward} 🪙 thưởng hoàn thành</p>}
        <div className="flex gap-2 justify-center">
          <button onClick={() => { setIdx(0); setInput(''); setScore(0); setDone(false); awardedRef.current = false }} className="bg-violet-600 text-white px-5 py-2 rounded-xl font-medium hover:bg-violet-700">Chơi lại</button>
          <button onClick={onExit} className="bg-gray-100 text-gray-700 px-5 py-2 rounded-xl font-medium hover:bg-gray-200">Đóng</button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 max-w-md mx-auto">
      <div className="flex items-center justify-between mb-4">
        <button onClick={onExit} className="text-gray-500 hover:text-gray-700">← Quay lại</button>
        <h2 className="text-xl font-bold text-gray-800 dark:text-white">⌨️ Đoán từ</h2>
        <span className="text-sm text-gray-500 tabular-nums">{idx + 1}/{pool.length}</span>
      </div>
      {word && (
        <motion.div key={word.id} initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
          className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-lg border border-gray-100 dark:border-gray-700 text-center mb-4">
          <div className="text-7xl mb-2">{word.emoji}</div>
          <p className="text-violet-600 dark:text-violet-400 font-semibold text-lg">{word.translation}</p>
          <p className="text-xs text-gray-400 mt-1">Gõ từ tiếng Anh tương ứng…</p>
        </motion.div>
      )}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        autoFocus
        placeholder="VD: apple"
        className={`w-full text-center text-xl font-bold border-2 rounded-2xl p-4 mb-3 transition-colors ${
          feedback === 'correct' ? 'border-emerald-400 bg-emerald-50' :
          feedback === 'wrong'   ? 'border-red-400 bg-red-50' :
          'border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white'
        }`}
      />
      <button onClick={submit} disabled={!input.trim()}
        className="w-full bg-violet-600 text-white py-3 rounded-2xl font-bold hover:bg-violet-700 disabled:opacity-50">
        {feedback === 'correct' ? '✅ Đúng rồi!' : 'Kiểm tra'}
      </button>
      <p className="text-center text-sm text-gray-400 mt-3">
        ⭐ {score} đúng{reward > 0 ? <> · hoàn thành ván +{reward} 🪙</> : ''}
      </p>
    </div>
  )
}

// ─── Hub ───────────────────────────────────────────────────────────────────

export default function GamesHub() {
  const currentMemberId = useStore((s) => s.currentMemberId)
  const members         = useStore((s) => s.members)
  const me = members.find((m) => m.id === currentMemberId)
  const [active, setActive] = useState<GameKey | null>(null)

  if (active === 'memory') return <MemoryMatch memberId={currentMemberId ?? ''} onExit={() => setActive(null)} />
  if (active === 'guess')  return <GuessGame   memberId={currentMemberId ?? ''} onExit={() => setActive(null)} />

  const GAMES: { key: GameKey; emoji: string; title: string; desc: string; gradient: string }[] = [
    { key: 'memory', emoji: '🧠', title: 'Tìm cặp giống nhau', desc: 'Ghép từ tiếng Anh với icon — luyện trí nhớ', gradient: 'from-violet-500 to-indigo-500' },
    { key: 'guess',  emoji: '⌨️', title: 'Đoán từ',           desc: 'Nhìn icon + nghĩa, gõ từ tiếng Anh',         gradient: 'from-emerald-500 to-teal-500' },
  ]

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">🎮 Trò chơi học tập</h1>
        <p className="text-gray-500 text-sm">
          Vừa chơi vừa học. Mỗi câu / cặp đúng được thưởng xu.
          {me && <span className="ml-2 font-medium text-amber-600">🪙 Bạn có {me.tokens} xu</span>}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {GAMES.map((g) => (
          <motion.button key={g.key}
            whileHover={{ y: -3 }}
            onClick={() => setActive(g.key)}
            className={`bg-gradient-to-br ${g.gradient} text-white rounded-3xl p-5 text-left shadow-lg hover:shadow-xl transition-shadow`}
          >
            <div className="text-5xl mb-3">{g.emoji}</div>
            <p className="text-xl font-bold mb-1">{g.title}</p>
            <p className="text-sm opacity-90">{g.desc}</p>
          </motion.button>
        ))}
      </div>
    </div>
  )
}
