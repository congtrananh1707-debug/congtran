import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../../store/useStore'
import { shuffle } from '../../utils/helpers'

export default function FamilyQuiz() {
  const questions = useStore((s) => s.quizQuestions)
  const members = useStore((s) => s.members)
  const currentMemberId = useStore((s) => s.currentMemberId)
  const addQuizQuestion = useStore((s) => s.addQuizQuestion)
  const removeQuizQuestion = useStore((s) => s.removeQuizQuestion)

  const me = members.find((m) => m.id === currentMemberId)
  const isParent = me?.role === 'dad' || me?.role === 'mom'

  const [mode, setMode] = useState<'menu' | 'play' | 'manage'>('menu')
  const [quizQuestions, setQuizQuestions] = useState<typeof questions>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ question: '', answers: ['', '', '', ''], correctIndex: 0 })

  const startQuiz = () => {
    if (questions.length === 0) return
    setQuizQuestions(shuffle(questions))
    setCurrentIdx(0)
    setScore(0)
    setSelected(null)
    setMode('play')
  }

  const currentQ = quizQuestions[currentIdx]

  const answer = (idx: number) => {
    if (selected !== null) return
    setSelected(idx)
    if (idx === currentQ.correctIndex) setScore((s) => s + 1)
  }

  const next = () => {
    if (currentIdx + 1 >= quizQuestions.length) {
      setMode('menu')
    } else {
      setCurrentIdx((i) => i + 1)
      setSelected(null)
    }
  }

  const submitQuestion = () => {
    if (!form.question.trim() || form.answers.some((a) => !a.trim())) return
    addQuizQuestion({ question: form.question.trim(), answers: form.answers.map((a) => a.trim()), correctIndex: form.correctIndex, createdBy: currentMemberId || '' })
    setForm({ question: '', answers: ['', '', '', ''], correctIndex: 0 })
    setShowAdd(false)
  }

  if (mode === 'play' && currentQ) {
    const isLast = currentIdx + 1 >= quizQuestions.length

    return (
      <div className="p-4 lg:p-6 max-w-2xl mx-auto">
        {/* Progress */}
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => setMode('menu')} className="text-gray-400 hover:text-gray-600">✕</button>
          <div className="flex-1 bg-gray-200 rounded-full h-2">
            <div className="bg-violet-500 rounded-full h-2 transition-all" style={{ width: `${((currentIdx + 1) / quizQuestions.length) * 100}%` }} />
          </div>
          <span className="text-sm text-gray-500 font-medium">{currentIdx + 1}/{quizQuestions.length}</span>
          <span className="text-sm bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">⭐ {score}</span>
        </div>

        {/* Question */}
        <AnimatePresence mode="wait">
          <motion.div key={currentIdx} initial={{ x: 30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -30, opacity: 0 }}>
            <div className="bg-gradient-to-br from-violet-500 to-indigo-500 text-white rounded-3xl p-6 mb-6 text-center shadow-lg">
              <p className="text-4xl mb-3">🧠</p>
              <p className="text-xl font-bold leading-snug">{currentQ.question}</p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {currentQ.answers.map((ans, i) => {
                let style = 'bg-white border-2 border-gray-200 text-gray-700 hover:border-violet-400'
                if (selected !== null) {
                  if (i === currentQ.correctIndex) style = 'bg-emerald-100 border-2 border-emerald-400 text-emerald-800'
                  else if (i === selected) style = 'bg-red-100 border-2 border-red-400 text-red-700'
                  else style = 'bg-gray-50 border-2 border-gray-100 text-gray-400'
                }

                return (
                  <motion.button
                    key={i}
                    whileTap={selected === null ? { scale: 0.97 } : {}}
                    onClick={() => answer(i)}
                    className={`${style} rounded-2xl p-4 text-left font-medium text-sm transition-all ${selected === null ? 'cursor-pointer active:scale-95' : 'cursor-default'}`}
                  >
                    <span className="inline-flex w-7 h-7 rounded-full bg-gray-100 items-center justify-center text-xs mr-3 font-bold">
                      {['A', 'B', 'C', 'D'][i]}
                    </span>
                    {ans}
                    {selected !== null && i === currentQ.correctIndex && <span className="float-right text-emerald-500">✅</span>}
                    {selected === i && i !== currentQ.correctIndex && <span className="float-right text-red-500">❌</span>}
                  </motion.button>
                )
              })}
            </div>

            {selected !== null && (
              <motion.button initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                onClick={next}
                className="w-full mt-5 bg-violet-600 text-white py-3.5 rounded-2xl font-bold text-lg hover:bg-violet-700 active:scale-95">
                {isLast ? '🏆 Xem kết quả' : 'Câu tiếp theo →'}
              </motion.button>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    )
  }

  if (mode === 'play' && !currentQ) {
    // Quiz finished
    const pct = Math.round((score / quizQuestions.length) * 100)
    return (
      <div className="p-4 lg:p-6 max-w-md mx-auto text-center">
        <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <div className="text-8xl mb-4">{pct >= 80 ? '🏆' : pct >= 50 ? '🎉' : '💪'}</div>
          <h2 className="text-3xl font-bold text-gray-800 mb-2">Hoàn thành!</h2>
          <p className="text-gray-500 mb-6">{me?.name} trả lời đúng <span className="text-violet-600 font-bold text-xl">{score}/{quizQuestions.length}</span> câu</p>
          <div className="bg-violet-50 rounded-3xl p-6 mb-6">
            <div className="text-5xl font-bold text-violet-600">{pct}%</div>
            <p className="text-gray-500 mt-1">{pct >= 80 ? '🌟 Xuất sắc!' : pct >= 50 ? '👍 Khá tốt!' : '📚 Cần cố gắng hơn!'}</p>
          </div>
          <div className="flex gap-3 justify-center">
            <button onClick={startQuiz} className="bg-violet-600 text-white px-6 py-3 rounded-2xl font-medium hover:bg-violet-700">Chơi lại</button>
            <button onClick={() => setMode('menu')} className="bg-gray-100 text-gray-700 px-6 py-3 rounded-2xl font-medium hover:bg-gray-200">Về menu</button>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">🧠 Đố vui gia đình</h1>
          <p className="text-gray-500 text-sm">{questions.length} câu hỏi</p>
        </div>
        {isParent && (
          <button onClick={() => setMode(mode === 'manage' ? 'menu' : 'manage')}
            className="text-sm bg-gray-100 text-gray-600 px-3 py-2 rounded-xl hover:bg-gray-200">
            ⚙️ Quản lý
          </button>
        )}
      </div>

      {mode === 'menu' && (
        <>
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            className="bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-600 text-white rounded-3xl p-8 text-center mb-6 shadow-xl"
          >
            <div className="text-6xl mb-4">🧠</div>
            <h2 className="text-2xl font-bold mb-2">Quiz Gia Đình</h2>
            <p className="text-violet-200 mb-6">Kiểm tra xem bạn hiểu về gia đình mình đến đâu!</p>
            <button onClick={startQuiz} disabled={questions.length === 0}
              className="bg-white text-violet-700 font-bold px-8 py-4 rounded-2xl text-lg hover:bg-violet-50 disabled:opacity-50 active:scale-95">
              🎮 Bắt đầu chơi!
            </button>
          </motion.div>

          {questions.length === 0 && (
            <div className="text-center text-gray-400 py-8">
              <p className="text-4xl mb-2">📝</p>
              <p>Chưa có câu hỏi nào. {isParent ? 'Thêm câu hỏi để bắt đầu!' : 'Nhờ bố/mẹ thêm câu hỏi nhé!'}</p>
            </div>
          )}
        </>
      )}

      {mode === 'manage' && isParent && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-gray-700">Quản lý câu hỏi</h3>
            <button onClick={() => setShowAdd(!showAdd)} className="bg-violet-600 text-white px-3 py-1.5 rounded-xl text-sm font-medium">+ Thêm câu hỏi</button>
          </div>

          {showAdd && (
            <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4 mb-4">
              <div className="mb-3">
                <label className="text-xs text-gray-500 block mb-1">Câu hỏi</label>
                <input value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })}
                  placeholder="VD: Ngày sinh nhật của Bố là ngày nào?" className="w-full border border-gray-200 rounded-xl p-2.5 text-sm" />
              </div>
              {form.answers.map((ans, i) => (
                <div key={i} className="mb-2 flex gap-2 items-center">
                  <button onClick={() => setForm({ ...form, correctIndex: i })}
                    className={`w-8 h-8 rounded-full flex-shrink-0 text-sm font-bold transition-all ${form.correctIndex === i ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-600'}`}>
                    {['A', 'B', 'C', 'D'][i]}
                  </button>
                  <input value={ans} onChange={(e) => { const a = [...form.answers]; a[i] = e.target.value; setForm({ ...form, answers: a }) }}
                    placeholder={`Đáp án ${['A', 'B', 'C', 'D'][i]}...`} className="flex-1 border border-gray-200 rounded-xl p-2 text-sm" />
                  {form.correctIndex === i && <span className="text-emerald-500 text-sm font-medium">✓ Đúng</span>}
                </div>
              ))}
              <p className="text-xs text-gray-400 mb-3">Bấm vào chữ cái để chọn đáp án đúng</p>
              <div className="flex gap-2">
                <button onClick={submitQuestion} className="bg-violet-600 text-white px-4 py-2 rounded-xl text-sm font-medium">Thêm</button>
                <button onClick={() => setShowAdd(false)} className="text-gray-500 px-4 py-2 rounded-xl text-sm hover:bg-gray-100">Hủy</button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {questions.map((q, i) => {
              const creator = members.find((m) => m.id === q.createdBy)
              return (
                <div key={q.id} className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 flex items-start gap-3">
                  <span className="bg-violet-100 text-violet-700 font-bold text-sm w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 text-sm">{q.question}</p>
                    <p className="text-xs text-emerald-600 mt-0.5">✅ {q.answers[q.correctIndex]}</p>
                    {creator && <p className="text-xs text-gray-400">{creator.emoji} {creator.name}</p>}
                  </div>
                  <button onClick={() => removeQuizQuestion(q.id)} className="text-gray-300 hover:text-red-400 text-sm flex-shrink-0">🗑</button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
