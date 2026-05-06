import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../../store/useStore'
import { ENGLISH_THEMES, ENGLISH_THEME_LABELS } from '../../types'
import type { VocabWord } from '../../types'

function speak(text: string) {
  if (!window.speechSynthesis) return
  const utt = new SpeechSynthesisUtterance(text)
  utt.lang = 'en-US'
  utt.rate = 0.85
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(utt)
}

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5)
}

// ─── Mini Quiz ────────────────────────────────────────────────────────────────

type QuizState = {
  words: VocabWord[]
  selectedWord: string | null
  matched: string[]   // word IDs successfully matched
  wrong: string | null
  shuffledTranslations: { id: string; text: string }[]
}

function MiniQuiz({ words, memberId }: { words: VocabWord[]; memberId: string }) {
  const masterVocabWord = useStore((s) => s.masterVocabWord)
  const quizWords = useMemo(() => shuffle(words).slice(0, 4), [words])

  const [state, setState] = useState<QuizState>(() => ({
    words: quizWords,
    selectedWord: null,
    matched: [],
    wrong: null,
    shuffledTranslations: shuffle(quizWords.map((w) => ({ id: w.id, text: w.translation }))),
  }))

  const [done, setDone] = useState(false)

  const selectWord = (id: string) => {
    if (state.matched.includes(id)) return
    setState((s) => ({ ...s, selectedWord: s.selectedWord === id ? null : id, wrong: null }))
  }

  const selectTranslation = (id: string) => {
    if (!state.selectedWord) return
    if (state.matched.includes(id)) return

    if (state.selectedWord === id) {
      const next = { ...state, matched: [...state.matched, id], selectedWord: null, wrong: null }
      setState(next)
      masterVocabWord(id, memberId)
      if (next.matched.length === quizWords.length) setTimeout(() => setDone(true), 400)
    } else {
      setState((s) => ({ ...s, wrong: s.selectedWord, selectedWord: null }))
      setTimeout(() => setState((s) => ({ ...s, wrong: null })), 600)
    }
  }

  if (done) {
    return (
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="text-center py-8">
        <div className="text-6xl mb-3">🏆</div>
        <p className="text-xl font-bold text-gray-800 dark:text-white mb-1">Xuất sắc!</p>
        <p className="text-gray-500 text-sm mb-4">Bạn đã ghép đúng tất cả! +{quizWords.length * 5} xu được ghi nhận</p>
        <button onClick={() => { setDone(false); setState({ words: quizWords, selectedWord: null, matched: [], wrong: null, shuffledTranslations: shuffle(quizWords.map((w) => ({ id: w.id, text: w.translation }))) }) }}
          className="bg-violet-600 text-white px-6 py-2 rounded-xl font-medium text-sm hover:bg-violet-700">
          Chơi lại
        </button>
      </motion.div>
    )
  }

  return (
    <div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 text-center">Chọn từ bên trái → chọn nghĩa tương ứng bên phải</p>
      <div className="flex gap-4">
        {/* Words column */}
        <div className="flex-1 space-y-2">
          {quizWords.map((w) => {
            const isMatched = state.matched.includes(w.id)
            const isSelected = state.selectedWord === w.id
            const isWrong = state.wrong === w.id
            return (
              <motion.button key={w.id}
                animate={isWrong ? { x: [-6, 6, -6, 6, 0] } : {}}
                transition={{ duration: 0.3 }}
                onClick={() => selectWord(w.id)}
                disabled={isMatched}
                className={`w-full py-3 px-4 rounded-xl font-medium text-sm transition-all ${
                  isMatched ? 'bg-emerald-100 text-emerald-700 line-through opacity-60' :
                  isSelected ? 'bg-violet-600 text-white shadow-lg scale-105' :
                  isWrong ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-violet-50 hover:text-violet-700'
                }`}>
                {w.word}
              </motion.button>
            )
          })}
        </div>

        {/* Translations column */}
        <div className="flex-1 space-y-2">
          {state.shuffledTranslations.map((t) => {
            const isMatched = state.matched.includes(t.id)
            return (
              <button key={t.id}
                onClick={() => selectTranslation(t.id)}
                disabled={isMatched || !state.selectedWord}
                className={`w-full py-3 px-4 rounded-xl font-medium text-sm transition-all ${
                  isMatched ? 'bg-emerald-100 text-emerald-700 line-through opacity-60' :
                  state.selectedWord ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 hover:bg-amber-100 cursor-pointer' :
                  'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-default'
                }`}>
                {t.text}
              </button>
            )
          })}
        </div>
      </div>
      <p className="text-center text-xs text-gray-400 mt-3">{state.matched.length}/{quizWords.length} cặp ghép đúng</p>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function EnglishAdventure() {
  const currentMemberId = useStore((s) => s.currentMemberId)
  const members         = useStore((s) => s.members)
  const vocabWords      = useStore((s) => s.vocabWords)
  const englishTheme    = useStore((s) => s.englishTheme)
  const setEnglishTheme = useStore((s) => s.setEnglishTheme)
  const masterVocabWord  = useStore((s) => s.masterVocabWord)
  const unmasterVocabWord= useStore((s) => s.unmasterVocabWord)
  const addVocabWord     = useStore((s) => s.addVocabWord)
  const removeVocabWord  = useStore((s) => s.removeVocabWord)

  const me = members.find((m) => m.id === currentMemberId)
  const isParent = me?.role === 'dad' || me?.role === 'mom'

  const [tab, setTab] = useState<'vocab' | 'quiz' | 'manage'>('vocab')
  const [showAddWord, setShowAddWord] = useState(false)
  const [wordForm, setWordForm] = useState({ word: '', translation: '', example: '' })

  const themeWords = vocabWords.filter((v) => v.theme === englishTheme)
  const masteredCount = themeWords.filter((v) => v.masteredBy.includes(currentMemberId || '')).length
  const progress = themeWords.length > 0 ? masteredCount / themeWords.length : 0

  // Show 6 words per day (rotate by day-of-year)
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000)
  const dailyWords = useMemo(() => {
    const n = Math.min(6, themeWords.length)
    const start = (dayOfYear * n) % Math.max(themeWords.length, 1)
    const result: VocabWord[] = []
    for (let i = 0; i < n; i++) result.push(themeWords[(start + i) % themeWords.length])
    return result.filter(Boolean)
  }, [themeWords, dayOfYear])

  const addWord = () => {
    if (!wordForm.word.trim() || !wordForm.translation.trim()) return
    addVocabWord({ ...wordForm, theme: englishTheme })
    setWordForm({ word: '', translation: '', example: '' })
    setShowAddWord(false)
  }

  const themeInfo = ENGLISH_THEME_LABELS[englishTheme] ?? { label: englishTheme, emoji: '📖' }

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-1">🇬🇧 English Adventure</h1>
        <p className="text-gray-500 text-sm">Học tiếng Anh cùng gia đình mỗi ngày</p>
      </div>

      {/* Theme selector */}
      <div className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-3xl p-4 mb-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs text-blue-200 font-medium uppercase tracking-wide">Chủ đề tuần này</p>
            <p className="text-xl font-bold">{themeInfo.emoji} {themeInfo.label}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{masteredCount}/{themeWords.length}</p>
            <p className="text-xs text-blue-200">từ đã thuộc</p>
          </div>
        </div>
        <div className="bg-white/20 rounded-full h-2.5">
          <motion.div className="bg-white rounded-full h-2.5" initial={{ width: 0 }} animate={{ width: `${progress * 100}%` }} transition={{ duration: 1 }} />
        </div>
        {isParent && (
          <div className="flex gap-2 mt-3 flex-wrap">
            {ENGLISH_THEMES.map((t) => {
              const info = ENGLISH_THEME_LABELS[t]
              return (
                <button key={t} onClick={() => setEnglishTheme(t)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                    t === englishTheme ? 'bg-white text-blue-700' : 'bg-white/20 text-white hover:bg-white/30'
                  }`}>
                  {info.emoji} {info.label}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        {[
          { key: 'vocab', label: '📚 Từ hôm nay' },
          { key: 'quiz',  label: '🎯 Mini Quiz'   },
          ...(isParent ? [{ key: 'manage', label: '⚙️ Quản lý từ' }] : []),
        ].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              tab === t.key ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Vocab tab */}
      {tab === 'vocab' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {dailyWords.map((word, i) => {
            const mastered = word.masteredBy.includes(currentMemberId || '')
            return (
              <motion.div key={word.id} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: i * 0.08 }}
                className={`rounded-2xl p-4 border-2 transition-all ${mastered ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'}`}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-xl font-bold text-gray-800 dark:text-white">{word.word}</p>
                    <p className="text-sm font-medium text-violet-600 dark:text-violet-400">{word.translation}</p>
                  </div>
                  <button onClick={() => speak(word.word)}
                    className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 p-2 rounded-xl hover:bg-blue-200 transition-colors text-lg"
                    title="Nghe phát âm">
                    🔊
                  </button>
                </div>
                {word.example && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 italic mb-3">"{word.example}"</p>
                )}
                <button
                  onClick={() => mastered ? unmasterVocabWord(word.id, currentMemberId || '') : masterVocabWord(word.id, currentMemberId || '')}
                  className={`w-full py-2 rounded-xl text-xs font-medium transition-all ${
                    mastered
                      ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                      : 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 hover:bg-violet-200'
                  }`}>
                  {mastered ? '✅ Đã thuộc — bỏ đánh dấu' : '⬜ Đánh dấu đã thuộc'}
                </button>
              </motion.div>
            )
          })}
          {dailyWords.length === 0 && (
            <div className="col-span-2 text-center py-12 text-gray-400">
              <p className="text-4xl mb-2">📚</p>
              <p>Chưa có từ vựng cho chủ đề này</p>
              {isParent && <p className="text-sm mt-1">Vào tab "Quản lý từ" để thêm từ mới</p>}
            </div>
          )}
        </div>
      )}

      {/* Quiz tab */}
      {tab === 'quiz' && (
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="font-bold text-gray-800 dark:text-white mb-4 text-center">🎯 Ghép từ với nghĩa đúng!</h3>
          {themeWords.length >= 4
            ? <MiniQuiz words={themeWords} memberId={currentMemberId || ''} />
            : (
              <div className="text-center py-8 text-gray-400">
                <p className="text-3xl mb-2">🎯</p>
                <p>Cần ít nhất 4 từ vựng để chơi quiz</p>
                <p className="text-sm mt-1">Hiện có {themeWords.length} từ trong chủ đề {themeInfo.label}</p>
              </div>
            )
          }
        </div>
      )}

      {/* Manage tab (parent only) */}
      {tab === 'manage' && isParent && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">{themeWords.length} từ trong chủ đề {themeInfo.label}</p>
            <button onClick={() => setShowAddWord(true)} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700">
              + Thêm từ
            </button>
          </div>

          <AnimatePresence>
            {showAddWord && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 mb-4">
                <h4 className="font-bold text-gray-700 dark:text-gray-200 mb-3">Thêm từ mới</h4>
                <div className="space-y-2">
                  <input value={wordForm.word} onChange={(e) => setWordForm({ ...wordForm, word: e.target.value })}
                    placeholder="Từ tiếng Anh (vd: apple)" className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl p-3 text-sm" />
                  <input value={wordForm.translation} onChange={(e) => setWordForm({ ...wordForm, translation: e.target.value })}
                    placeholder="Nghĩa tiếng Việt (vd: quả táo)" className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl p-3 text-sm" />
                  <input value={wordForm.example} onChange={(e) => setWordForm({ ...wordForm, example: e.target.value })}
                    placeholder="Câu ví dụ (tuỳ chọn)" className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl p-3 text-sm" />
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setShowAddWord(false)} className="text-gray-500 px-4 py-2 rounded-xl text-sm hover:bg-gray-100">Hủy</button>
                    <button onClick={addWord} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700">Thêm</button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-2">
            {themeWords.map((w) => (
              <div key={w.id} className="bg-white dark:bg-gray-800 rounded-xl p-3 flex items-center gap-3 border border-gray-100 dark:border-gray-700 shadow-sm">
                <button onClick={() => speak(w.word)} className="text-blue-500 text-lg flex-shrink-0">🔊</button>
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-gray-800 dark:text-white">{w.word}</span>
                  <span className="text-gray-400 mx-2">→</span>
                  <span className="text-violet-600 dark:text-violet-400">{w.translation}</span>
                  {w.example && <p className="text-xs text-gray-400 truncate italic">{w.example}</p>}
                </div>
                <span className="text-xs text-emerald-600 flex-shrink-0">{w.masteredBy.length > 0 ? `✅ ${w.masteredBy.length} thuộc` : ''}</span>
                <button onClick={() => removeVocabWord(w.id)} className="text-gray-300 hover:text-red-400 text-sm flex-shrink-0">🗑</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
