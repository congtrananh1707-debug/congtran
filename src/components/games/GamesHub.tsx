import { useState, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../../store/useStore'
import { shuffle } from '../../utils/helpers'
import { VOCAB_DATA } from '../../data/vocab'

type GameKey = 'memory' | 'guess' | 'hangman' | 'scramble'

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

// ─── Hangman ──────────────────────────────────────────────────────────────
// Classic 6-mistake word guessing game using VOCAB_DATA. Each lost limb is
// drawn with text emoji so we don't need an asset pipeline.

const HANGMAN_STAGES = ['😄', '🙂', '😐', '😟', '😨', '😰', '💀']

function HangmanGame({ memberId, onExit }: { memberId: string; onExit: () => void }) {
  const updateMember = useStore((s) => s.updateMember)
  const members      = useStore((s) => s.members)
  const reward       = useStore((s) => s.gameRewards.hangmanComplete)

  // Only pick reasonable-length words (4–8 letters, no spaces)
  const pickWord = () => {
    const pool = VOCAB_DATA.filter((v) => /^[a-zA-Z]{4,8}$/.test(v.word))
    return shuffle(pool)[0] ?? VOCAB_DATA[0]
  }
  const [target, setTarget] = useState(pickWord)
  const [guessed, setGuessed] = useState<Set<string>>(new Set())
  const [done, setDone] = useState<'idle' | 'won' | 'lost'>('idle')
  const awardedRef = useRef(false)

  const letters = target.word.toLowerCase().split('')
  const wrongCount = [...guessed].filter((g) => !letters.includes(g)).length
  const allLettersFound = letters.every((l) => guessed.has(l))

  const finish = (outcome: 'won' | 'lost') => {
    if (outcome === 'won' && !awardedRef.current && reward > 0) {
      awardedRef.current = true
      const me = members.find((m) => m.id === memberId)
      if (me) updateMember(memberId, { tokens: me.tokens + reward })
    }
    setDone(outcome)
  }

  const guess = (letter: string) => {
    if (done !== 'idle' || guessed.has(letter)) return
    const next = new Set(guessed); next.add(letter)
    setGuessed(next)
    const stillWrong = [...next].filter((g) => !letters.includes(g)).length
    const won = letters.every((l) => next.has(l))
    if (won) finish('won')
    else if (stillWrong >= HANGMAN_STAGES.length - 1) finish('lost')
  }

  const restart = () => {
    setTarget(pickWord())
    setGuessed(new Set())
    setDone('idle')
    awardedRef.current = false
  }

  const rows = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm']
  const stageIdx = Math.min(wrongCount, HANGMAN_STAGES.length - 1)

  return (
    <div className="p-4 lg:p-6 max-w-md mx-auto">
      <div className="flex items-center justify-between mb-4">
        <button onClick={onExit} className="text-gray-500 hover:text-gray-700">← Quay lại</button>
        <h2 className="text-xl font-bold text-gray-800 dark:text-white">🪢 Hangman</h2>
        <span className="text-sm text-gray-500">{wrongCount}/{HANGMAN_STAGES.length - 1} sai</span>
      </div>

      {/* Hint card */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 text-center mb-4">
        <div className="text-7xl mb-2">{HANGMAN_STAGES[stageIdx]}</div>
        {target.emoji && <div className="text-3xl mb-1">{target.emoji}</div>}
        <p className="text-violet-600 dark:text-violet-400 font-semibold">{target.translation}</p>
      </div>

      {/* Word slots */}
      <div className="flex justify-center gap-2 mb-5 flex-wrap">
        {letters.map((l, i) => {
          const reveal = guessed.has(l) || done === 'lost'
          return (
            <div key={i} className={`w-9 h-11 border-b-2 flex items-center justify-center text-xl font-bold uppercase ${
              reveal ? (done === 'lost' && !guessed.has(l) ? 'text-red-400 border-red-300' : 'text-emerald-700 border-emerald-300') : 'text-gray-400 border-gray-300'
            }`}>
              {reveal ? l : ''}
            </div>
          )
        })}
      </div>

      {/* Keyboard */}
      <div className="space-y-1.5">
        {rows.map((row) => (
          <div key={row} className="flex justify-center gap-1">
            {row.split('').map((l) => {
              const used = guessed.has(l)
              const isWrong = used && !letters.includes(l)
              const isRight = used && letters.includes(l)
              return (
                <button key={l} onClick={() => guess(l)} disabled={used || done !== 'idle'}
                  className={`w-8 h-10 sm:w-9 rounded-lg font-bold text-sm uppercase transition-colors ${
                    isWrong ? 'bg-red-200 text-red-700' :
                    isRight ? 'bg-emerald-200 text-emerald-700' :
                    'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-violet-100 disabled:opacity-40'
                  }`}>
                  {l}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      <AnimatePresence>
        {done !== 'idle' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.7 }} animate={{ scale: 1 }} className="bg-white dark:bg-gray-800 rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl">
              <div className="text-6xl mb-2">{done === 'won' ? '🏆' : '😿'}</div>
              <p className="text-xl font-bold text-gray-800 dark:text-white mb-1">
                {done === 'won' ? 'Tuyệt vời!' : 'Hết lượt rồi'}
              </p>
              <p className="text-gray-500 mb-1">Từ: <strong className="text-violet-600">{target.word}</strong> — {target.translation}</p>
              {done === 'won' && reward > 0 && <p className="text-amber-600 font-semibold mb-3">+{reward} 🪙</p>}
              <div className="flex gap-2 justify-center mt-3">
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

// ─── Word Scramble ─────────────────────────────────────────────────────────
// Letters of a word are shuffled; kid taps them in order. 10 words/round.

function ScrambleGame({ memberId, onExit }: { memberId: string; onExit: () => void }) {
  const updateMember = useStore((s) => s.updateMember)
  const members      = useStore((s) => s.members)
  const reward       = useStore((s) => s.gameRewards.scrambleComplete)

  const buildPool = () =>
    shuffle(VOCAB_DATA.filter((v) => /^[a-zA-Z]{3,7}$/.test(v.word))).slice(0, 10)

  const [pool] = useState(buildPool)
  const [idx, setIdx] = useState(0)
  const [picked, setPicked] = useState<number[]>([])  // index into `tiles`
  const [score, setScore] = useState(0)
  const [done, setDone] = useState(false)
  const awardedRef = useRef(false)

  const word = pool[idx]
  // Stable tile order per word — useMemo keyed by word id so picks remap correctly
  const tiles = useMemo<{ ch: string; i: number }[]>(() => {
    if (!word) return []
    const letters = word.word.toLowerCase().split('')
    return shuffle(letters.map((ch, i) => ({ ch, i })))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [word?.id])

  const guessSoFar = picked.map((p) => tiles[p].ch).join('')
  const target = word?.word.toLowerCase() ?? ''
  const correct = guessSoFar === target

  const finish = () => {
    if (!awardedRef.current && reward > 0) {
      awardedRef.current = true
      const me = members.find((m) => m.id === memberId)
      if (me) updateMember(memberId, { tokens: me.tokens + reward })
    }
    setDone(true)
  }

  const pickTile = (i: number) => {
    if (correct || picked.includes(i)) return
    setPicked([...picked, i])
  }
  const undo = () => setPicked(picked.slice(0, -1))

  const next = () => {
    if (correct) setScore((s) => s + 1)
    setPicked([])
    if (idx + 1 >= pool.length) finish()
    else setIdx((i) => i + 1)
  }

  if (done) {
    return (
      <div className="p-4 lg:p-6 max-w-md mx-auto text-center">
        <div className="text-6xl mb-3">{score >= 8 ? '🏆' : score >= 5 ? '🎉' : '💪'}</div>
        <p className="text-xl font-bold text-gray-800 dark:text-white mb-1">{score}/{pool.length} đúng</p>
        {reward > 0 && <p className="text-gray-500 mb-4">+{reward} 🪙 thưởng hoàn thành</p>}
        <div className="flex gap-2 justify-center">
          <button onClick={onExit} className="bg-violet-600 text-white px-5 py-2 rounded-xl font-medium hover:bg-violet-700">Đóng</button>
        </div>
      </div>
    )
  }

  if (!word) return null

  return (
    <div className="p-4 lg:p-6 max-w-md mx-auto">
      <div className="flex items-center justify-between mb-4">
        <button onClick={onExit} className="text-gray-500 hover:text-gray-700">← Quay lại</button>
        <h2 className="text-xl font-bold text-gray-800 dark:text-white">🔤 Xếp chữ</h2>
        <span className="text-sm text-gray-500 tabular-nums">{idx + 1}/{pool.length}</span>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 text-center mb-4">
        {word.emoji && <div className="text-5xl mb-1">{word.emoji}</div>}
        <p className="text-violet-600 dark:text-violet-400 font-semibold mb-3">{word.translation}</p>
        <div className={`flex justify-center gap-1 flex-wrap min-h-[3rem] items-center rounded-xl p-2 border-2 ${
          correct ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200 dark:border-gray-700'
        }`}>
          {picked.length === 0 && <span className="text-gray-300 text-sm">Bấm chữ cái bên dưới…</span>}
          {picked.map((p, i) => (
            <span key={i} className="w-8 h-10 bg-violet-100 text-violet-700 rounded-lg flex items-center justify-center font-bold uppercase">
              {tiles[p].ch}
            </span>
          ))}
        </div>
      </div>

      {/* Tile picker */}
      <div className="grid grid-cols-7 gap-1.5 mb-3">
        {tiles.map((t, i) => {
          const used = picked.includes(i)
          return (
            <button key={i} onClick={() => pickTile(i)} disabled={used || correct}
              className={`h-10 rounded-lg font-bold uppercase transition-colors text-sm ${
                used ? 'bg-gray-100 dark:bg-gray-800 text-gray-300' :
                'bg-gradient-to-br from-violet-500 to-indigo-500 text-white hover:from-violet-600'
              }`}>
              {t.ch}
            </button>
          )
        })}
      </div>

      <div className="flex gap-2">
        <button onClick={undo} disabled={picked.length === 0 || correct}
          className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-2 rounded-xl text-sm font-medium hover:bg-gray-200 disabled:opacity-40">
          ← Xóa
        </button>
        <button onClick={next}
          className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${
            correct ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'bg-violet-600 text-white hover:bg-violet-700'
          }`}>
          {correct ? '✅ Tiếp theo →' : 'Bỏ qua'}
        </button>
      </div>
      <p className="text-center text-xs text-gray-400 mt-3">⭐ {score} đúng{reward > 0 ? ` · hoàn thành 10 từ +${reward} 🪙` : ''}</p>
    </div>
  )
}

// ─── Hub ───────────────────────────────────────────────────────────────────

export default function GamesHub() {
  const currentMemberId = useStore((s) => s.currentMemberId)
  const members         = useStore((s) => s.members)
  const me = members.find((m) => m.id === currentMemberId)
  const [active, setActive] = useState<GameKey | null>(null)

  if (active === 'memory')   return <MemoryMatch  memberId={currentMemberId ?? ''} onExit={() => setActive(null)} />
  if (active === 'guess')    return <GuessGame    memberId={currentMemberId ?? ''} onExit={() => setActive(null)} />
  if (active === 'hangman')  return <HangmanGame  memberId={currentMemberId ?? ''} onExit={() => setActive(null)} />
  if (active === 'scramble') return <ScrambleGame memberId={currentMemberId ?? ''} onExit={() => setActive(null)} />

  const GAMES: { key: GameKey; emoji: string; title: string; desc: string; gradient: string }[] = [
    { key: 'memory',   emoji: '🧠', title: 'Tìm cặp giống nhau', desc: 'Ghép từ tiếng Anh với icon — luyện trí nhớ',  gradient: 'from-violet-500 to-indigo-500' },
    { key: 'guess',    emoji: '⌨️', title: 'Đoán từ',           desc: 'Nhìn icon + nghĩa, gõ từ tiếng Anh',          gradient: 'from-emerald-500 to-teal-500' },
    { key: 'hangman',  emoji: '🪢', title: 'Hangman',           desc: 'Đoán từng chữ cái trước khi hết lượt',        gradient: 'from-rose-500 to-pink-500'    },
    { key: 'scramble', emoji: '🔤', title: 'Xếp chữ',           desc: 'Các chữ cái bị xáo trộn — xếp lại đúng từ',    gradient: 'from-amber-500 to-orange-500' },
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
