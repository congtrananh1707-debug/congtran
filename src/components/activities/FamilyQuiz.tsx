import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../../store/useStore'
import { shuffle } from '../../utils/helpers'
import { isParentRole } from '../../types'
import type { Member, QuizQuestion } from '../../types'

// ─── Auto-generate questions from member data ──────────────────────────────────

type AutoQ = Omit<QuizQuestion, 'id'>

function generateFromMembers(members: Member[]): AutoQ[] {
  const qs: AutoQ[] = []
  const names = members.map((m) => m.name)
  const rand = (arr: string[], exclude?: string) => shuffle(arr.filter((x) => x !== exclude))
  const createdBy = '__auto__'

  // Birthday questions
  members.forEach((m) => {
    if (!m.birthday) return
    const correct = m.birthday.split('-').slice(1).reverse().join('/') // DD/MM
    const otherDates = members
      .filter((x) => x.id !== m.id && x.birthday)
      .map((x) => x.birthday.split('-').slice(1).reverse().join('/'))
    const fakes = ['05/08', '12/03', '20/10', '08/01', '17/06', '25/11'].filter((d) => d !== correct)
    const wrong = shuffle([...otherDates, ...fakes]).slice(0, 3)
    if (wrong.length < 3) return
    const answers = shuffle([correct, ...wrong])
    qs.push({ question: `Ngày sinh nhật của ${m.emoji} ${m.name} là ngày nào?`, answers, correctIndex: answers.indexOf(correct), createdBy })
  })

  // Favorite food questions
  members.forEach((m) => {
    if (!m.favoriteFoods.length) return
    const food = m.favoriteFoods[0]
    const wrongNames = rand(names, m.name).slice(0, 3)
    if (wrongNames.length < 3) return
    const answers = shuffle([m.name, ...wrongNames])
    qs.push({ question: `Ai trong gia đình thích ăn ${food} nhất?`, answers, correctIndex: answers.indexOf(m.name), createdBy })
  })

  // Blood type questions
  const BLOOD = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']
  members.forEach((m) => {
    if (!m.bloodType) return
    const wrong = shuffle(BLOOD.filter((b) => b !== m.bloodType)).slice(0, 3)
    const answers = shuffle([m.bloodType, ...wrong])
    qs.push({ question: `Nhóm máu của ${m.emoji} ${m.name} là gì?`, answers, correctIndex: answers.indexOf(m.bloodType), createdBy })
  })

  // Goal questions
  members.forEach((m) => {
    if (!m.goals.length) return
    const goal = m.goals[0]
    const wrongNames = rand(names, m.name).slice(0, 3)
    if (wrongNames.length < 3) return
    const answers = shuffle([m.name, ...wrongNames])
    qs.push({ question: `"${goal}" là mục tiêu của ai?`, answers, correctIndex: answers.indexOf(m.name), createdBy })
  })

  // Allergy questions — fun trivia for safety awareness
  members.forEach((m) => {
    if (!m.allergies.length) return
    const allergen = m.allergies[0]
    const wrongNames = rand(names, m.name).slice(0, 3)
    if (wrongNames.length < 3) return
    const answers = shuffle([m.name, ...wrongNames])
    qs.push({ question: `Ai trong nhà bị dị ứng với ${allergen}?`, answers, correctIndex: answers.indexOf(m.name), createdBy })
  })

  // Birthday MONTH-only (easier variant)
  members.forEach((m) => {
    if (!m.birthday) return
    const month = parseInt(m.birthday.split('-')[1], 10)
    if (!month) return
    const wrong = shuffle([1,2,3,4,5,6,7,8,9,10,11,12].filter((x) => x !== month)).slice(0, 3)
    const answers = shuffle([month, ...wrong]).map((x) => `Tháng ${x}`)
    qs.push({ question: `${m.emoji} ${m.name} sinh vào tháng nào?`, answers, correctIndex: answers.indexOf(`Tháng ${month}`), createdBy })
  })

  return qs
}

// ─── General-knowledge & fun question pool (kid-friendly, Vietnamese) ─────────
// Built once at module-load so we don't re-allocate per render. Each entry's
// correct answer sits at index 0 in `answers`; we shuffle when scheduling.

const TRIVIA_QUESTIONS: { q: string; a: [string, string, string, string] }[] = [
  // Science / nature
  { q: 'Nước có công thức hóa học là gì?', a: ['H₂O', 'CO₂', 'NaCl', 'O₂'] },
  { q: 'Hành tinh nào gần Mặt Trời nhất?', a: ['Sao Thủy', 'Sao Kim', 'Trái Đất', 'Sao Hỏa'] },
  { q: 'Mặt Trời mọc ở hướng nào?', a: ['Đông', 'Tây', 'Nam', 'Bắc'] },
  { q: 'Con vật nào có cổ dài nhất?', a: ['Hươu cao cổ', 'Voi', 'Hà mã', 'Cá sấu'] },
  { q: 'Động vật nào có thể bay?', a: ['Chim', 'Cá', 'Mèo', 'Chó'] },
  { q: 'Trái Đất có bao nhiêu mặt trăng?', a: ['1', '2', '3', '0'] },
  { q: 'Cá thở bằng gì?', a: ['Mang', 'Phổi', 'Mũi', 'Miệng'] },
  { q: 'Cây cối hô hấp thải ra khí gì?', a: ['Oxy (ban ngày)', 'Khí hydro', 'Khí nitơ', 'Khí helium'] },
  { q: 'Tốc độ ánh sáng nhanh hơn tốc độ âm thanh — đúng hay sai?', a: ['Đúng', 'Sai', 'Bằng nhau', 'Không biết'] },
  { q: 'Mưa rơi từ đâu xuống?', a: ['Đám mây', 'Mặt trời', 'Mặt đất', 'Cầu vồng'] },
  { q: 'Vào mùa nào lá rụng nhiều nhất?', a: ['Thu', 'Xuân', 'Hè', 'Đông'] },
  { q: 'Có bao nhiêu màu trong cầu vồng?', a: ['7', '5', '6', '8'] },
  { q: 'Loại cây nào cho gỗ làm bút chì?', a: ['Cây tuyết tùng', 'Cây dừa', 'Cây bàng', 'Cây xoài'] },
  { q: 'Con vật nào ngủ đông?', a: ['Gấu', 'Voi', 'Chó', 'Mèo'] },
  { q: 'Đại dương lớn nhất thế giới là gì?', a: ['Thái Bình Dương', 'Đại Tây Dương', 'Ấn Độ Dương', 'Bắc Băng Dương'] },
  { q: 'Nóng chảy là khi chất rắn chuyển thành gì?', a: ['Chất lỏng', 'Chất khí', 'Plasma', 'Lửa'] },

  // Geography Vietnam
  { q: 'Thủ đô của Việt Nam là gì?', a: ['Hà Nội', 'TP. Hồ Chí Minh', 'Đà Nẵng', 'Huế'] },
  { q: 'Núi cao nhất Việt Nam là?', a: ['Fansipan', 'Bà Đen', 'Bạch Mã', 'Lang Biang'] },
  { q: 'Sông nào dài nhất Việt Nam?', a: ['Sông Mekong', 'Sông Hồng', 'Sông Đồng Nai', 'Sông Đà'] },
  { q: 'Vịnh nào ở Việt Nam là di sản thế giới?', a: ['Vịnh Hạ Long', 'Vịnh Cam Ranh', 'Vịnh Nha Trang', 'Vịnh Vũng Tàu'] },
  { q: 'Việt Nam có hình chữ gì trên bản đồ?', a: ['Chữ S', 'Chữ L', 'Chữ J', 'Chữ T'] },

  // Math (kid-level)
  { q: '5 + 7 = ?', a: ['12', '11', '13', '14'] },
  { q: '9 × 8 = ?', a: ['72', '64', '81', '74'] },
  { q: '100 chia 4 bằng?', a: ['25', '20', '30', '24'] },
  { q: 'Một tuần có bao nhiêu ngày?', a: ['7', '5', '6', '10'] },
  { q: 'Một năm có bao nhiêu tháng?', a: ['12', '10', '11', '13'] },
  { q: 'Một giờ có bao nhiêu phút?', a: ['60', '30', '100', '24'] },
  { q: 'Tam giác có mấy cạnh?', a: ['3', '4', '5', '2'] },
  { q: 'Hình tròn có mấy góc?', a: ['Không có', '4', '1', 'Vô số'] },

  // Vietnamese culture / food (fun!)
  { q: 'Phở là món ăn của nước nào?', a: ['Việt Nam', 'Trung Quốc', 'Thái Lan', 'Nhật Bản'] },
  { q: 'Bánh chưng ăn vào dịp nào?', a: ['Tết Nguyên Đán', 'Trung Thu', 'Rằm tháng 7', 'Quốc khánh'] },
  { q: 'Bánh trung thu có hình gì?', a: ['Tròn hoặc vuông', 'Tam giác', 'Trái tim', 'Ngôi sao'] },
  { q: 'Áo dài là trang phục truyền thống của ai?', a: ['Người Việt', 'Người Hàn', 'Người Nhật', 'Người Thái'] },
  { q: 'Đèn ông sao xuất hiện vào ngày nào?', a: ['Trung Thu', 'Tết Nguyên Đán', 'Giáng sinh', 'Tết Hàn Thực'] },

  // Hài hước — fun trick questions
  { q: 'Cái gì càng cho càng có?', a: ['Tình yêu', 'Tiền', 'Đồ ăn', 'Quần áo'] },
  { q: 'Cái gì không có nhưng nói có?', a: ['Cái không', 'Cái có', 'Cái biết', 'Cái ngu'] },
  { q: 'Chim non biết bay chưa?', a: ['Chưa, phải tập đã', 'Sinh ra là bay liền', 'Không bao giờ bay', 'Bay luôn 10 km'] },
  { q: 'Con gì có 4 chân nhưng không đi được?', a: ['Cái bàn', 'Con bò', 'Con voi', 'Con kiến'] },
  { q: 'Cái gì luôn đi trước bạn dù bạn chạy nhanh đến đâu?', a: ['Bóng của bạn (lúc nắng)', 'Bạn cùng lớp', 'Con chó', 'Cha mẹ'] },
  { q: 'Cái gì càng nóng càng đóng băng?', a: ['Trò đùa', 'Nước đá', 'Cốc trà', 'Bánh kem'] },
  { q: 'Cái gì ướt khi đem ra phơi nắng?', a: ['Cá khô… ngâm nước', 'Khăn mặt', 'Quần áo', 'Tóc'] },
  { q: 'Có bao nhiêu chữ cái trong "BẢNG CHỮ CÁI"?', a: ['11 chữ', '29 chữ', '26 chữ', '5 chữ'] },
  { q: 'Mèo kêu thế nào?', a: ['Meo meo', 'Gâu gâu', 'Quác quác', 'Ụt ịt'] },
  { q: 'Chó kêu thế nào?', a: ['Gâu gâu', 'Meo meo', 'Cục tác', 'Ò ó o'] },
  { q: 'Gà trống gáy lúc nào?', a: ['Sáng sớm', 'Đêm khuya', 'Giữa trưa', 'Buổi tối'] },

  // Vietnamese folk / general
  { q: 'Trong truyện Tấm Cám, ai là người tốt?', a: ['Tấm', 'Cám', 'Dì ghẻ', 'Vua'] },
  { q: 'Bánh trưng vuông tượng trưng cho gì?', a: ['Đất', 'Trời', 'Mặt trăng', 'Mặt trời'] },
  { q: 'Bánh dày tròn tượng trưng cho gì?', a: ['Trời', 'Đất', 'Núi', 'Sông'] },
  { q: 'Lễ hội đua thuyền diễn ra ở đâu?', a: ['Trên sông', 'Trên núi', 'Trên đường', 'Trên cánh đồng'] },
]

function generateTrivia(count: number): AutoQ[] {
  return shuffle(TRIVIA_QUESTIONS).slice(0, count).map(({ q, a }) => {
    const correct = a[0]
    const answers = shuffle([...a])
    return {
      question: q,
      answers,
      correctIndex: answers.indexOf(correct),
      createdBy: '__auto__',
    }
  })
}

// Stable hash of member fields the question generators read.
// Reading the relevant fields directly means renaming the function or hand-
// rolling Quest types doesn't bust the cache, but editing a birthday/food/
// goal/allergy/blood/name does.
function memberHash(members: Member[]): string {
  return members
    .map((m) =>
      [m.id, m.name, m.emoji, m.birthday, m.bloodType, m.favoriteFoods.join(','), m.allergies.join(','), m.goals.join(',')].join('|')
    )
    .join('::')
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function FamilyQuiz() {
  const questions          = useStore((s) => s.quizQuestions)
  const members            = useStore((s) => s.members)
  const currentMemberId    = useStore((s) => s.currentMemberId)
  const addQuizQuestion    = useStore((s) => s.addQuizQuestion)
  const updateQuizQuestion = useStore((s) => s.updateQuizQuestion)
  const removeQuizQuestion = useStore((s) => s.removeQuizQuestion)

  const me = members.find((m) => m.id === currentMemberId)
  const isParent = me ? isParentRole(me.role) : false

  const [mode, setMode] = useState<'menu' | 'play' | 'manage'>('menu')
  const [quizQuestions, setQuizQuestions] = useState<typeof questions>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ question: '', answers: ['', '', '', ''], correctIndex: 0 })
  const [autoMsg, setAutoMsg] = useState('')
  const [submitDone, setSubmitDone] = useState(false)

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
    if (currentIdx + 1 >= quizQuestions.length) setMode('menu')
    else { setCurrentIdx((i) => i + 1); setSelected(null) }
  }

  const openEdit = (id: string) => {
    const q = questions.find((x) => x.id === id)
    if (!q) return
    setEditingId(id)
    // Quiz expects 4 answers; pad/truncate to keep the UI simple
    const a = [...q.answers, '', '', '', ''].slice(0, 4)
    setForm({ question: q.question, answers: a, correctIndex: q.correctIndex })
    setShowAdd(true)
  }

  const submitQuestion = () => {
    if (!form.question.trim() || form.answers.some((a) => !a.trim()) || submitDone) return
    const payload = {
      question: form.question.trim(),
      answers: form.answers.map((a) => a.trim()),
      correctIndex: form.correctIndex,
    }
    if (editingId) {
      updateQuizQuestion(editingId, payload)
    } else {
      addQuizQuestion({ ...payload, createdBy: currentMemberId || '' })
    }
    setSubmitDone(true)
    setTimeout(() => {
      setForm({ question: '', answers: ['', '', '', ''], correctIndex: 0 })
      setShowAdd(false); setEditingId(null); setSubmitDone(false)
    }, 600)
  }

  const autoGenerate = (silent = false) => {
    // Remove ALL prior auto-generated questions so we start clean.
    questions
      .filter((q) => q.id.startsWith('auto-') || q.createdBy === '__auto__')
      .forEach((q) => removeQuizQuestion(q.id))

    const fromMembers = generateFromMembers(members)
    // Top up to a healthier pool size with fun + general-knowledge trivia.
    const target = Math.max(20, fromMembers.length + 12)
    const trivia = generateTrivia(target - fromMembers.length)
    const all = [...fromMembers, ...trivia]
    all.forEach((q) => addQuizQuestion(q))

    if (!silent) {
      setAutoMsg(`✅ Đã tạo ${all.length} câu (${fromMembers.length} từ hồ sơ + ${trivia.length} kiến thức/hài hước)`)
      setTimeout(() => setAutoMsg(''), 3500)
    }
  }

  // Auto-refresh auto-questions when any sourced member field changes.
  // We only kick off when there are already auto-questions (so first-time
  // users still have to opt in via the manual button); after that, edits to
  // a member's birthday / food / blood / goal / allergy regenerate
  // automatically.
  const lastHashRef = useRef<string>('')
  useEffect(() => {
    const hasAuto = questions.some((q) => q.createdBy === '__auto__' || q.id.startsWith('auto-'))
    if (!hasAuto) return
    const h = memberHash(members)
    if (h === lastHashRef.current) return
    if (lastHashRef.current === '') {
      // First run after mount — adopt current hash, don't regenerate
      lastHashRef.current = h
      return
    }
    lastHashRef.current = h
    autoGenerate(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberHash(members)])

  // ── Play mode ──────────────────────────────────────────────────────────────

  if (mode === 'play' && currentQ) {
    const isLast = currentIdx + 1 >= quizQuestions.length
    return (
      <div className="p-4 lg:p-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => setMode('menu')} className="text-gray-400 hover:text-gray-600">✕</button>
          <div className="flex-1 bg-gray-200 rounded-full h-2">
            <div className="bg-violet-500 rounded-full h-2 transition-all" style={{ width: `${((currentIdx + 1) / quizQuestions.length) * 100}%` }} />
          </div>
          <span className="text-sm text-gray-500 font-medium">{currentIdx + 1}/{quizQuestions.length}</span>
          <span className="text-sm bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">⭐ {score}</span>
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={currentIdx} initial={{ x: 30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -30, opacity: 0 }}>
            <div className="bg-gradient-to-br from-violet-500 to-indigo-500 text-white rounded-3xl p-6 mb-6 text-center shadow-lg">
              <p className="text-4xl mb-3">🧠</p>
              <p className="text-xl font-bold leading-snug">{currentQ.question}</p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {currentQ.answers.map((ans, i) => {
                let style = 'bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:border-violet-400'
                if (selected !== null) {
                  if (i === currentQ.correctIndex) style = 'bg-emerald-100 border-2 border-emerald-400 text-emerald-800'
                  else if (i === selected) style = 'bg-red-100 border-2 border-red-400 text-red-700'
                  else style = 'bg-gray-50 dark:bg-gray-700 border-2 border-gray-100 dark:border-gray-600 text-gray-400'
                }
                return (
                  <motion.button key={i} whileTap={selected === null ? { scale: 0.97 } : {}} onClick={() => answer(i)}
                    className={`${style} rounded-2xl p-4 text-left font-medium text-sm transition-all ${selected === null ? 'cursor-pointer active:scale-95' : 'cursor-default'}`}>
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
    const pct = Math.round((score / quizQuestions.length) * 100)
    return (
      <div className="p-4 lg:p-6 max-w-md mx-auto text-center">
        <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <div className="text-8xl mb-4">{pct >= 80 ? '🏆' : pct >= 50 ? '🎉' : '💪'}</div>
          <h2 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">Hoàn thành!</h2>
          <p className="text-gray-500 mb-6">{me?.name} trả lời đúng <span className="text-violet-600 font-bold text-xl">{score}/{quizQuestions.length}</span> câu</p>
          <div className="bg-violet-50 dark:bg-violet-900/30 rounded-3xl p-6 mb-6">
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

  // ── Menu / Manage mode ─────────────────────────────────────────────────────

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">🧠 Đố vui gia đình</h1>
          <p className="text-gray-500 text-sm">{questions.length} câu hỏi</p>
        </div>
        {isParent && (
          <button onClick={() => setMode(mode === 'manage' ? 'menu' : 'manage')}
            className="text-sm bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-3 py-2 rounded-xl hover:bg-gray-200">
            ⚙️ Quản lý
          </button>
        )}
      </div>

      {mode === 'menu' && (
        <>
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            className="bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-600 text-white rounded-3xl p-8 text-center mb-6 shadow-xl">
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
              <p>{isParent ? 'Nhấn "Quản lý" → "Tạo từ hồ sơ" để sinh câu hỏi tự động!' : 'Nhờ bố/mẹ thêm câu hỏi nhé!'}</p>
            </div>
          )}
        </>
      )}

      {mode === 'manage' && isParent && (
        <div>
          <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
            <h3 className="font-bold text-gray-700 dark:text-gray-200">Quản lý câu hỏi</h3>
            <div className="flex gap-2">
              {/* Auto-generate button */}
              <button onClick={() => autoGenerate()}
                className="bg-amber-500 text-white px-3 py-1.5 rounded-xl text-sm font-medium hover:bg-amber-600 flex items-center gap-1">
                🔄 Tạo bộ câu hỏi
              </button>
              <button onClick={() => setShowAdd(!showAdd)}
                className="bg-violet-600 text-white px-3 py-1.5 rounded-xl text-sm font-medium">
                + Thêm câu hỏi
              </button>
            </div>
          </div>

          {autoMsg && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-amber-700 text-sm mb-3">{autoMsg}</div>
          )}

          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl px-4 py-2.5 text-amber-700 dark:text-amber-300 text-xs mb-4 leading-relaxed">
            💡 <strong>Tạo bộ câu hỏi</strong>: tự sinh câu về sinh nhật / món ăn / nhóm máu / mục tiêu / dị ứng từ hồ sơ thành viên,
            cộng thêm câu kiến thức (toán, khoa học, địa lý Việt Nam) và câu đố hài hước.
            Sau lần đầu, app sẽ <strong>tự cập nhật</strong> mỗi khi bạn sửa thông tin thành viên.
          </div>

          <AnimatePresence>
            {showAdd && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-700 rounded-2xl p-4 mb-4">
                <div className="mb-3">
                  <label className="text-xs text-gray-500 block mb-1">Câu hỏi</label>
                  <input value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })}
                    placeholder="VD: Ngày sinh nhật của Bố là ngày nào?"
                    className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl p-2.5 text-sm" />
                </div>
                {form.answers.map((ans, i) => (
                  <div key={i} className="mb-2 flex gap-2 items-center">
                    <button onClick={() => setForm({ ...form, correctIndex: i })}
                      className={`w-8 h-8 rounded-full flex-shrink-0 text-sm font-bold transition-all ${form.correctIndex === i ? 'bg-emerald-500 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'}`}>
                      {['A', 'B', 'C', 'D'][i]}
                    </button>
                    <input value={ans}
                      onChange={(e) => { const a = [...form.answers]; a[i] = e.target.value; setForm({ ...form, answers: a }) }}
                      placeholder={`Đáp án ${['A', 'B', 'C', 'D'][i]}...`}
                      className="flex-1 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl p-2 text-sm" />
                    {form.correctIndex === i && <span className="text-emerald-500 text-sm font-medium">✓ Đúng</span>}
                  </div>
                ))}
                <p className="text-xs text-gray-400 mb-3">Bấm vào chữ cái để chọn đáp án đúng</p>
                <div className="flex gap-2">
                  <button onClick={submitQuestion} disabled={!form.question.trim() || form.answers.some((a) => !a.trim()) || submitDone} className="bg-violet-600 text-white px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50 transition-all">
                    {submitDone ? '✅ Đã lưu!' : editingId ? 'Lưu thay đổi' : 'Thêm'}
                  </button>
                  <button onClick={() => { setShowAdd(false); setEditingId(null) }} disabled={submitDone} className="text-gray-500 px-4 py-2 rounded-xl text-sm hover:bg-gray-100 disabled:opacity-40">Hủy</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-2">
            {questions.map((q, i) => {
              const creator = members.find((m) => m.id === q.createdBy)
              const isAuto = q.createdBy === '__auto__'
              return (
                <div key={q.id} className="bg-white dark:bg-gray-800 rounded-2xl p-3 shadow-sm border border-gray-100 dark:border-gray-700 flex items-start gap-3">
                  <span className="bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 font-bold text-sm w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 dark:text-white text-sm">{q.question}</p>
                    <p className="text-xs text-emerald-600 mt-0.5">✅ {q.answers[q.correctIndex]}</p>
                    <p className="text-xs text-gray-400">{isAuto ? '🤖 Tự động' : creator ? `${creator.emoji} ${creator.name}` : ''}</p>
                  </div>
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <button onClick={() => openEdit(q.id)} className="text-gray-300 hover:text-violet-500 text-sm" title="Sửa">✏️</button>
                    <button onClick={() => removeQuizQuestion(q.id)} className="text-gray-300 hover:text-red-400 text-sm" title="Xóa">🗑</button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
