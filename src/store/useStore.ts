import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  Member, HealthRecord, SkillNode, Quest, Reward, MailMessage,
  GratitudeNote, WheelItem, QuizQuestion, FamilyQuest, Album, Photo,
  MoodTag, MailReaction, QuestStatus, SilentHero, VocabWord, CalendarEvent,
  Ancestor, Anniversary,
} from '../types'
import { nanoid, todayStr } from '../utils/helpers'
import { queueDelete } from '../utils/deletionQueue'
import { VOCAB_DATA } from '../data/vocab'

// ─── Seed data ────────────────────────────────────────────────────────────────

const SEED_MEMBERS: Member[] = [
  { id: 'dad',    name: 'Bố',  role: 'dad',   emoji: '👨', color: 'bg-blue-500',  birthday: '1985-03-15', bloodType: 'O+', favoriteFoods: ['Phở', 'Bánh mì'],   allergies: [],      goals: ['Chạy 5km/tuần'],            tokens: 0  },
  { id: 'mom',    name: 'Mẹ',  role: 'mom',   emoji: '👩', color: 'bg-rose-500',  birthday: '1988-07-22', bloodType: 'A+', favoriteFoods: ['Bún bò', 'Sushi'],  allergies: [],      goals: ['Yoga mỗi ngày'],            tokens: 0  },
  { id: 'child1', name: 'Con', role: 'child', emoji: '🧒', color: 'bg-amber-500', birthday: '2015-12-01', bloodType: 'O+', favoriteFoods: ['Gà rán', 'Pizza'],  allergies: ['Tôm'], goals: ['Học giỏi toán', 'Biết bơi'], tokens: 30 },
]

const SEED_QUESTS: Quest[] = [
  { id: 'q1', title: 'Ăn hết cơm',               description: 'Ăn hết phần cơm của mình mà không bỏ thừa',          type: 'daily',   tokens: 5,  assignedTo: ['child1'],                status: 'active',   createdBy: 'mom' },
  { id: 'q2', title: 'Tự đánh răng buổi tối',    description: 'Nhớ đánh răng trước khi đi ngủ',                    type: 'daily',   tokens: 3,  assignedTo: ['child1'],                status: 'active',   createdBy: 'dad' },
  { id: 'q3', title: 'Học bài 30 phút',           description: 'Ngồi học bài nghiêm túc 30 phút mỗi ngày',         type: 'daily',   tokens: 10, assignedTo: ['child1'],                status: 'pending',  createdBy: 'mom', completedBy: 'child1', completedAt: Date.now() - 3600000 },
  { id: 'q4', title: 'Dọn phòng sạch sẽ',        description: 'Dọn phòng ngủ gọn gàng, sạch sẽ',                  type: 'special', tokens: 20, assignedTo: ['child1'],                status: 'approved', createdBy: 'dad', completedBy: 'child1', completedAt: Date.now() - 86400000 },
  { id: 'q5', title: '7 ngày không dùng màn hình khi ăn', description: 'Cả nhà không dùng điện thoại/TV trong bữa ăn 7 ngày', type: 'family', tokens: 50, assignedTo: ['dad','mom','child1'], status: 'active', createdBy: 'dad' },
]

const SEED_REWARDS: Reward[] = [
  { id: 'rw1', name: 'Xem phim 30 phút',  emoji: '🎬', tokenCost: 20,  active: true },
  { id: 'rw2', name: 'Chơi game 30 phút', emoji: '🎮', tokenCost: 25,  active: true },
  { id: 'rw3', name: 'Chọn món ăn tối',   emoji: '🍕', tokenCost: 30,  active: true },
  { id: 'rw4', name: 'Đi chơi công viên', emoji: '🎡', tokenCost: 80,  active: true },
  { id: 'rw5', name: 'Mua đồ chơi nhỏ',   emoji: '🧸', tokenCost: 150, active: true },
]

const SEED_SKILLS: SkillNode[] = [
  { id: 'sk1',  memberId: 'child1', category: 'academics',  name: 'Đọc trôi chảy',         icon: '📖', achieved: true,  achievedDate: '2024-03-01' },
  { id: 'sk2',  memberId: 'child1', category: 'academics',  name: 'Làm toán nhẩm',          icon: '🔢', achieved: true,  achievedDate: '2024-05-15' },
  { id: 'sk3',  memberId: 'child1', category: 'academics',  name: 'Viết chính tả đúng',     icon: '✍️', achieved: false },
  { id: 'sk4',  memberId: 'child1', category: 'sports',     name: 'Biết đi xe đạp',         icon: '🚲', achieved: true,  achievedDate: '2024-06-20' },
  { id: 'sk5',  memberId: 'child1', category: 'sports',     name: 'Biết bơi',                icon: '🏊', achieved: false },
  { id: 'sk6',  memberId: 'child1', category: 'softSkills', name: 'Nói xin chào người lớn', icon: '👋', achieved: true,  achievedDate: '2023-09-01' },
  { id: 'sk7',  memberId: 'child1', category: 'softSkills', name: 'Tự dọn đồ chơi',         icon: '🧹', achieved: true,  achievedDate: '2024-01-10' },
  { id: 'sk8',  memberId: 'child1', category: 'arts',       name: 'Vẽ tranh đơn giản',      icon: '🎨', achieved: true,  achievedDate: '2024-02-14' },
  { id: 'sk9',  memberId: 'child1', category: 'arts',       name: 'Hát một bài hát',         icon: '🎵', achieved: false },
  { id: 'sk10', memberId: 'child1', category: 'social',     name: 'Chơi hòa thuận với bạn', icon: '🤝', achieved: true,  achievedDate: '2024-04-05' },
]

const SEED_HEALTH: HealthRecord[] = [
  { id: 'h1', memberId: 'child1', date: '2023-01-01', height: 105, weight: 18   },
  { id: 'h2', memberId: 'child1', date: '2023-06-01', height: 108, weight: 19   },
  { id: 'h3', memberId: 'child1', date: '2024-01-01', height: 112, weight: 20.5 },
  { id: 'h4', memberId: 'child1', date: '2024-06-01', height: 116, weight: 22   },
  { id: 'h5', memberId: 'child1', date: '2025-01-01', height: 120, weight: 23.5 },
]

const SEED_MAILS: MailMessage[] = [
  {
    id: 'm1', from: 'child1', to: ['mom','dad'], subject: 'Con yêu bố mẹ ❤️',
    body: 'Bố mẹ ơi, con muốn nói là con yêu bố mẹ rất nhiều! Hôm nay con được điểm 10 môn toán đó!',
    mood: 'happy', timestamp: Date.now() - 7200000, readBy: ['mom'],
    reactions: [{ memberId: 'mom', type: 'heart' }],
    replies: [{ id: 'r1', from: 'mom', body: 'Bé giỏi quá! Mẹ tự hào về con lắm! 🥰', timestamp: Date.now() - 3600000 }],
  },
]

const SEED_GRATITUDE: GratitudeNote[] = [
  { id: 'g1', from: 'child1', to: 'mom',    message: 'Cảm ơn mẹ đã nấu cơm ngon cho con!',             color: 'bg-pink-200 border-pink-300',    timestamp: Date.now() - 86400000  },
  { id: 'g2', from: 'mom',    to: 'child1', message: 'Mẹ biết ơn con vì con luôn cố gắng học tập!',    color: 'bg-yellow-200 border-yellow-300', timestamp: Date.now() - 172800000 },
  { id: 'g3', from: 'dad',    to: 'mom',    message: 'Cảm ơn mẹ đã chăm sóc cả nhà mỗi ngày 💕',      color: 'bg-purple-200 border-purple-300', timestamp: Date.now() - 259200000 },
]

const SEED_WHEEL: WheelItem[] = [
  { id: 'w1',  category: 'activity', label: 'Đi công viên',       emoji: '🌳' },
  { id: 'w2',  category: 'activity', label: 'Xem phim ở nhà',     emoji: '🎬' },
  { id: 'w3',  category: 'activity', label: 'Chơi board game',     emoji: '🎲' },
  { id: 'w4',  category: 'activity', label: 'Đi bơi',             emoji: '🏊' },
  { id: 'w5',  category: 'activity', label: 'Làm bánh cùng nhau', emoji: '🍰' },
  { id: 'w6',  category: 'menu',     label: 'Phở bò',             emoji: '🍜' },
  { id: 'w7',  category: 'menu',     label: 'Pizza',               emoji: '🍕' },
  { id: 'w8',  category: 'menu',     label: 'Gà rán',             emoji: '🍗' },
  { id: 'w9',  category: 'menu',     label: 'Lẩu gia đình',       emoji: '🫕' },
  { id: 'w10', category: 'menu',     label: 'Cơm nhà',            emoji: '🍚' },
]

const SEED_QUIZ: QuizQuestion[] = [
  { id: 'qz1', question: 'Ngày sinh nhật của Bố là ngày nào?',    answers: ['15/3', '22/7', '1/12', '5/9'],          correctIndex: 0, createdBy: 'mom' },
  { id: 'qz2', question: 'Mẹ thích ăn món gì nhất?',              answers: ['Phở', 'Bún bò', 'Cơm tấm', 'Bánh mì'], correctIndex: 1, createdBy: 'dad' },
  { id: 'qz3', question: 'Con học lớp mấy?',                      answers: ['Lớp 1', 'Lớp 2', 'Lớp 3', 'Lớp 4'],   correctIndex: 0, createdBy: 'dad' },
]

const SEED_FAMILY_QUESTS: FamilyQuest[] = [
  { id: 'fq1', title: '7 ngày không màn hình khi ăn', description: 'Cả nhà cùng để điện thoại xuống trong bữa ăn', targetDays: 7, currentDays: 3, startDate: todayStr(), active: true },
]

const SEED_ALBUMS: Album[] = [
  { id: 'al1', title: 'Sinh nhật Con 2024', date: '2024-12-01', coverEmoji: '🎂', description: 'Bữa tiệc sinh nhật vui vẻ của cả nhà'   },
  { id: 'al2', title: 'Đi biển hè 2024',   date: '2024-07-15', coverEmoji: '🏖️', description: 'Kỳ nghỉ hè đáng nhớ tại Đà Nẵng'        },
]

const SEED_HEROES: SilentHero[] = [
  {
    id: 'sh1', memberId: 'child1', loggedBy: 'mom',
    deed: 'Con chủ động rót nước cho Bà khi thấy Bà khát mà không cần ai nhắc',
    timestamp: Date.now() - 86400000 * 2,
    reactions: [{ memberId: 'dad', emoji: '❤️' }, { memberId: 'mom', emoji: '🌟' }],
  },
]

// Curated ~1200-word English-Vietnamese dataset across 13 themes lives in
// src/data/vocab.ts so this file stays scannable. Words live on Supabase
// after the first sync, so this seed only matters for fresh devices.
const SEED_VOCAB: VocabWord[] = VOCAB_DATA

const SEED_ANCESTORS: Ancestor[] = [
  { id: 'anc1', name: 'Cụ Ông nội', gender: 'male',   relationship: 'Cụ nội', birthYear: 1920, deathYear: 1995, lunarDeathDay: 10, lunarDeathMonth: 3,  biography: 'Người sáng lập gia đình, sống trung thực và cần cù.', parentIds: [], photoUrl: undefined },
  { id: 'anc2', name: 'Cụ Bà nội', gender: 'female',  relationship: 'Cụ nội', birthYear: 1925, deathYear: 2010, lunarDeathDay: 20, lunarDeathMonth: 8,  biography: 'Hiền lành, thương con cháu hết mực.',                 parentIds: [], spouseId: 'anc1' },
  { id: 'anc3', name: 'Ông nội',   gender: 'male',    relationship: 'Ông nội', birthYear: 1948, deathYear: 2018, lunarDeathDay: 5,  lunarDeathMonth: 12, biography: 'Cựu chiến binh, yêu nước và yêu gia đình.',           parentIds: ['anc1', 'anc2'] },
]

const SEED_ANNIVERSARIES: Anniversary[] = [
  { id: 'av1', name: 'Giỗ Cụ Ông nội', ancestorId: 'anc1', lunarDay: 10, lunarMonth: 3,  notes: 'Chuẩn bị mâm cỗ truyền thống' },
  { id: 'av2', name: 'Giỗ Cụ Bà nội',  ancestorId: 'anc2', lunarDay: 20, lunarMonth: 8,  notes: 'Cả nhà tụ họp đông đủ' },
  { id: 'av3', name: 'Giỗ Ông nội',    ancestorId: 'anc3', lunarDay: 5,  lunarMonth: 12, notes: 'Thắp hương tưởng nhớ' },
]

// ─── Store type ───────────────────────────────────────────────────────────────

type Store = {
  // Auth
  pin: string
  isAuthenticated: boolean
  currentMemberId: string | null

  // Appearance / theme
  appName: string
  bgImage: string
  darkMode: boolean
  parentPin: string

  // Supabase sync
  familyCode: string   // unique per family, used as partition key in Supabase
  familyName: string   // display name for this family
  lastPushAt: number   // epoch ms of last successful push to Supabase (cross-device version vector)

  // Data
  members: Member[]
  health: HealthRecord[]
  skills: SkillNode[]
  quests: Quest[]
  rewards: Reward[]
  mails: MailMessage[]
  gratitude: GratitudeNote[]
  wheelItems: WheelItem[]
  quizQuestions: QuizQuestion[]
  familyQuests: FamilyQuest[]
  albums: Album[]
  photos: Photo[]
  silentHeroes: SilentHero[]
  vocabWords: VocabWord[]
  englishTheme: string
  calendarEvents: CalendarEvent[]

  // Heritage
  ancestors: Ancestor[]
  anniversaries: Anniversary[]

  // Auth actions
  verifyPin: (input: string) => boolean
  logout: () => void
  setCurrentMember: (id: string) => void
  setPin: (pin: string) => void

  // Appearance actions
  setAppName: (name: string) => void
  setBgImage: (url: string) => void
  setDarkMode: (on: boolean) => void
  setParentPin: (pin: string) => void

  // Members
  addMember: (m: Omit<Member, 'id' | 'tokens'>) => void
  updateMember: (id: string, data: Partial<Member>) => void
  removeMember: (id: string) => void

  // Health
  addHealthRecord: (memberId: string, date: string, height: number, weight: number) => void
  removeHealthRecord: (id: string) => void

  // Skills
  addSkill: (memberId: string, category: import('../types').SkillCategory, name: string, icon: string) => void
  toggleSkill: (id: string) => void
  removeSkill: (id: string) => void

  // Quests
  addQuest: (data: Omit<Quest, 'id' | 'status'>) => void
  updateQuest: (id: string, data: Partial<Quest>) => void
  completeQuest: (id: string, memberId: string) => void
  approveQuest: (id: string) => void
  rejectQuest: (id: string) => void
  removeQuest: (id: string) => void

  // Rewards
  addReward: (name: string, emoji: string, tokenCost: number) => void
  updateReward: (id: string, data: Partial<Reward>) => void
  removeReward: (id: string) => void
  redeemReward: (rewardId: string, memberId: string) => boolean

  // Mail
  sendMail: (from: string, to: string[], subject: string, body: string, mood: MoodTag) => void
  replyMail: (mailId: string, from: string, body: string, reaction?: MailReaction) => void
  reactMail: (mailId: string, memberId: string, type: MailReaction) => void
  markRead: (mailId: string, memberId: string) => void

  // Gratitude
  addGratitude: (from: string, to: string, message: string, color: string) => void
  removeGratitude: (id: string) => void

  // Wheel
  addWheelItem: (category: 'activity' | 'menu', label: string, emoji: string) => void
  updateWheelItem: (id: string, data: Partial<WheelItem>) => void
  removeWheelItem: (id: string) => void

  // Quiz
  addQuizQuestion: (q: Omit<QuizQuestion, 'id'>) => void
  updateQuizQuestion: (id: string, data: Partial<QuizQuestion>) => void
  removeQuizQuestion: (id: string) => void

  // Family Quests
  addFamilyQuest: (fq: Omit<FamilyQuest, 'id'>) => void
  updateFamilyQuest: (id: string, data: Partial<FamilyQuest>) => void
  incrementFamilyQuest: (id: string) => void
  removeFamilyQuest: (id: string) => void

  // Albums & Photos
  addAlbum: (title: string, date: string, coverEmoji: string, description: string) => void
  updateAlbum: (id: string, data: Partial<Album>) => void
  removeAlbum: (id: string) => void
  addPhoto: (albumId: string, dataUrl: string, caption: string, taggedMembers: string[], date: string) => void
  updatePhoto: (id: string, data: Partial<Photo>) => void
  removePhoto: (id: string) => void

  // Silent Heroes
  addSilentHero: (memberId: string, loggedBy: string, deed: string) => void
  updateSilentHero: (id: string, data: Partial<SilentHero>) => void
  reactSilentHero: (id: string, memberId: string, emoji: string) => void
  removeSilentHero: (id: string) => void

  // Vocab / English
  addVocabWord: (w: Omit<VocabWord, 'id' | 'masteredBy'>) => void
  updateVocabWord: (id: string, data: Partial<VocabWord>) => void
  masterVocabWord: (id: string, memberId: string) => void
  unmasterVocabWord: (id: string, memberId: string) => void
  removeVocabWord: (id: string) => void
  setEnglishTheme: (theme: string) => void

  // Supabase sync
  setFamilyCode: (code: string) => void
  setFamilyName: (name: string) => void
  setLastPushAt: (t: number) => void

  // Calendar events
  addCalendarEvent: (ev: Omit<CalendarEvent, 'id'>) => void
  updateCalendarEvent: (id: string, data: Partial<CalendarEvent>) => void
  removeCalendarEvent: (id: string) => void

  // Heritage - Ancestors
  addAncestor: (a: Omit<Ancestor, 'id'>) => void
  updateAncestor: (id: string, data: Partial<Ancestor>) => void
  removeAncestor: (id: string) => void

  // Heritage - Anniversaries
  addAnniversary: (ann: Omit<Anniversary, 'id'>) => void
  updateAnniversary: (id: string, data: Partial<Anniversary>) => void
  removeAnniversary: (id: string) => void
}

// ─── Store implementation ─────────────────────────────────────────────────────

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      pin: '1234',
      isAuthenticated: false,
      currentMemberId: null,

      appName: 'MyBaoFamily',
      bgImage: '',
      darkMode: false,
      parentPin: '',
      familyCode: 'fam-1234',  // deterministic: always fam-${pin}, never random
      familyName: 'Gia đình của tôi',
      lastPushAt: 0,

      members:        SEED_MEMBERS,
      health:         SEED_HEALTH,
      skills:         SEED_SKILLS,
      quests:         SEED_QUESTS,
      rewards:        SEED_REWARDS,
      mails:          SEED_MAILS,
      gratitude:      SEED_GRATITUDE,
      wheelItems:     SEED_WHEEL,
      quizQuestions:  SEED_QUIZ,
      familyQuests:   SEED_FAMILY_QUESTS,
      albums:         SEED_ALBUMS,
      photos:         [],
      silentHeroes:   SEED_HEROES,
      vocabWords:     SEED_VOCAB,
      englishTheme:   'kitchen',
      calendarEvents: [],
      ancestors:      SEED_ANCESTORS,
      anniversaries:  SEED_ANNIVERSARIES,

      // Auth
      verifyPin: (input) => {
        if (input === get().pin) {
          // familyCode is deterministic from PIN: same PIN on any device = same family partition
          set({ isAuthenticated: true, familyCode: `fam-${input}` })
          return true
        }
        return false
      },
      logout: () => set({ isAuthenticated: false, currentMemberId: null }),
      setCurrentMember: (id) => set({ currentMemberId: id }),
      setPin: (pin) => set({ pin, familyCode: `fam-${pin}` }),

      // Supabase sync
      setFamilyCode: (familyCode) => set({ familyCode }),
      setFamilyName: (familyName) => set({ familyName }),
      setLastPushAt: (lastPushAt) => set({ lastPushAt }),

      // Appearance
      setAppName: (appName) => set({ appName }),
      setBgImage: (bgImage) => set({ bgImage }),
      setDarkMode: (darkMode) => set({ darkMode }),
      setParentPin: (parentPin) => set({ parentPin }),

      // Members
      addMember: (m) => set((s) => ({ members: [...s.members, { ...m, id: nanoid(), tokens: 0 }] })),
      updateMember: (id, data) => set((s) => ({ members: s.members.map((m) => m.id === id ? { ...m, ...data } : m) })),
      removeMember: (id) => { queueDelete('members', id); set((s) => ({ members: s.members.filter((m) => m.id !== id) })) },

      // Health
      addHealthRecord: (memberId, date, height, weight) =>
        set((s) => ({ health: [...s.health, { id: nanoid(), memberId, date, height, weight }] })),
      removeHealthRecord: (id) => { queueDelete('health_records', id); set((s) => ({ health: s.health.filter((h) => h.id !== id) })) },

      // Skills
      addSkill: (memberId, category, name, icon) =>
        set((s) => ({ skills: [...s.skills, { id: nanoid(), memberId, category, name, icon, achieved: false }] })),
      toggleSkill: (id) => set((s) => ({
        skills: s.skills.map((sk) => sk.id === id
          ? { ...sk, achieved: !sk.achieved, achievedDate: !sk.achieved ? todayStr() : undefined }
          : sk),
      })),
      removeSkill: (id) => { queueDelete('skills', id); set((s) => ({ skills: s.skills.filter((sk) => sk.id !== id) })) },

      // Quests
      addQuest: (data) => set((s) => ({ quests: [{ ...data, id: nanoid(), status: 'active' as QuestStatus }, ...s.quests] })),
      updateQuest: (id, data) => set((s) => ({ quests: s.quests.map((q) => q.id === id ? { ...q, ...data } : q) })),
      completeQuest: (id, memberId) => set((s) => ({
        quests: s.quests.map((q) => q.id === id ? { ...q, status: 'pending', completedBy: memberId, completedAt: Date.now() } : q),
      })),
      approveQuest: (id) => set((s) => {
        const quest = s.quests.find((q) => q.id === id)
        // Guard: only approve if status is exactly 'pending' — prevents double-token
        // when two parents approve the same quest simultaneously on different devices.
        if (!quest || !quest.completedBy || quest.status !== 'pending') return s
        return {
          quests: s.quests.map((q) => q.id === id ? { ...q, status: 'approved' } : q),
          members: s.members.map((m) => m.id === quest.completedBy ? { ...m, tokens: m.tokens + quest.tokens } : m),
        }
      }),
      rejectQuest: (id) => set((s) => ({ quests: s.quests.map((q) => q.id === id ? { ...q, status: 'rejected' } : q) })),
      removeQuest: (id) => { queueDelete('quests', id); set((s) => ({ quests: s.quests.filter((q) => q.id !== id) })) },

      // Rewards
      addReward: (name, emoji, tokenCost) =>
        set((s) => ({ rewards: [...s.rewards, { id: nanoid(), name, emoji, tokenCost, active: true }] })),
      updateReward: (id, data) => set((s) => ({ rewards: s.rewards.map((r) => r.id === id ? { ...r, ...data } : r) })),
      removeReward: (id) => { queueDelete('rewards', id); set((s) => ({ rewards: s.rewards.filter((r) => r.id !== id) })) },
      redeemReward: (rewardId, memberId) => {
        const state = get()
        const reward = state.rewards.find((r) => r.id === rewardId)
        const member = state.members.find((m) => m.id === memberId)
        if (!reward || !member || member.tokens < reward.tokenCost) return false
        set((s) => ({ members: s.members.map((m) => m.id === memberId ? { ...m, tokens: m.tokens - reward.tokenCost } : m) }))
        return true
      },

      // Mail
      sendMail: (from, to, subject, body, mood) =>
        set((s) => ({ mails: [{ id: nanoid(), from, to, subject, body, mood, timestamp: Date.now(), readBy: [from], reactions: [], replies: [] }, ...s.mails] })),
      replyMail: (mailId, from, body, reaction) => set((s) => ({
        mails: s.mails.map((m) => m.id === mailId ? { ...m, replies: [...m.replies, { id: nanoid(), from, body, reaction, timestamp: Date.now() }] } : m),
      })),
      reactMail: (mailId, memberId, type) => set((s) => ({
        mails: s.mails.map((m) => m.id === mailId ? { ...m, reactions: [...m.reactions.filter((r) => r.memberId !== memberId), { memberId, type }] } : m),
      })),
      markRead: (mailId, memberId) => set((s) => ({
        mails: s.mails.map((m) => m.id === mailId ? { ...m, readBy: [...new Set([...m.readBy, memberId])] } : m),
      })),

      // Gratitude
      addGratitude: (from, to, message, color) =>
        set((s) => ({ gratitude: [{ id: nanoid(), from, to, message, color, timestamp: Date.now() }, ...s.gratitude] })),
      removeGratitude: (id) => { queueDelete('gratitude_notes', id); set((s) => ({ gratitude: s.gratitude.filter((g) => g.id !== id) })) },

      // Wheel
      addWheelItem: (category, label, emoji) =>
        set((s) => ({ wheelItems: [...s.wheelItems, { id: nanoid(), category, label, emoji }] })),
      updateWheelItem: (id, data) => set((s) => ({ wheelItems: s.wheelItems.map((w) => w.id === id ? { ...w, ...data } : w) })),
      removeWheelItem: (id) => { queueDelete('wheel_items', id); set((s) => ({ wheelItems: s.wheelItems.filter((w) => w.id !== id) })) },

      // Quiz
      addQuizQuestion: (q) => set((s) => ({ quizQuestions: [...s.quizQuestions, { ...q, id: nanoid() }] })),
      updateQuizQuestion: (id, data) => set((s) => ({ quizQuestions: s.quizQuestions.map((q) => q.id === id ? { ...q, ...data } : q) })),
      removeQuizQuestion: (id) => { queueDelete('quiz_questions', id); set((s) => ({ quizQuestions: s.quizQuestions.filter((q) => q.id !== id) })) },

      // Family Quests
      addFamilyQuest: (fq) => set((s) => ({ familyQuests: [...s.familyQuests, { ...fq, id: nanoid() }] })),
      updateFamilyQuest: (id, data) => set((s) => ({ familyQuests: s.familyQuests.map((fq) => fq.id === id ? { ...fq, ...data } : fq) })),
      incrementFamilyQuest: (id) => set((s) => ({
        familyQuests: s.familyQuests.map((fq) => fq.id === id ? { ...fq, currentDays: Math.min(fq.currentDays + 1, fq.targetDays) } : fq),
      })),
      removeFamilyQuest: (id) => { queueDelete('family_quests', id); set((s) => ({ familyQuests: s.familyQuests.filter((fq) => fq.id !== id) })) },

      // Albums & Photos
      addAlbum: (title, date, coverEmoji, description) =>
        set((s) => ({ albums: [{ id: nanoid(), title, date, coverEmoji, description }, ...s.albums] })),
      updateAlbum: (id, data) => set((s) => ({ albums: s.albums.map((a) => a.id === id ? { ...a, ...data } : a) })),
      removeAlbum: (id) => {
        queueDelete('albums', id)
        // Cascade: queue deletion of all photos in this album
        get().photos.filter((p) => p.albumId === id).forEach((p) => queueDelete('photos', p.id))
        set((s) => ({ albums: s.albums.filter((a) => a.id !== id), photos: s.photos.filter((p) => p.albumId !== id) }))
      },
      addPhoto: (albumId, dataUrl, caption, taggedMembers, date) =>
        set((s) => ({ photos: [...s.photos, { id: nanoid(), albumId, dataUrl, caption, taggedMembers, date }] })),
      updatePhoto: (id, data) => set((s) => ({ photos: s.photos.map((p) => p.id === id ? { ...p, ...data } : p) })),
      removePhoto: (id) => { queueDelete('photos', id); set((s) => ({ photos: s.photos.filter((p) => p.id !== id) })) },

      // Silent Heroes
      addSilentHero: (memberId, loggedBy, deed) =>
        set((s) => ({ silentHeroes: [{ id: nanoid(), memberId, loggedBy, deed, timestamp: Date.now(), reactions: [] }, ...s.silentHeroes] })),
      updateSilentHero: (id, data) => set((s) => ({ silentHeroes: s.silentHeroes.map((h) => h.id === id ? { ...h, ...data } : h) })),
      reactSilentHero: (id, memberId, emoji) => set((s) => ({
        silentHeroes: s.silentHeroes.map((h) =>
          h.id === id ? { ...h, reactions: [...h.reactions.filter((r) => r.memberId !== memberId), { memberId, emoji }] } : h
        ),
      })),
      removeSilentHero: (id) => { queueDelete('silent_heroes', id); set((s) => ({ silentHeroes: s.silentHeroes.filter((h) => h.id !== id) })) },

      // Vocab / English
      addVocabWord: (w) => set((s) => ({ vocabWords: [...s.vocabWords, { ...w, id: nanoid(), masteredBy: [] }] })),
      updateVocabWord: (id, data) => set((s) => ({ vocabWords: s.vocabWords.map((v) => v.id === id ? { ...v, ...data } : v) })),
      masterVocabWord: (id, memberId) => set((s) => ({
        vocabWords: s.vocabWords.map((v) => v.id === id ? { ...v, masteredBy: [...new Set([...v.masteredBy, memberId])] } : v),
      })),
      unmasterVocabWord: (id, memberId) => set((s) => ({
        vocabWords: s.vocabWords.map((v) => v.id === id ? { ...v, masteredBy: v.masteredBy.filter((m) => m !== memberId) } : v),
      })),
      removeVocabWord: (id) => { queueDelete('vocab_words', id); set((s) => ({ vocabWords: s.vocabWords.filter((v) => v.id !== id) })) },
      setEnglishTheme: (englishTheme) => set({ englishTheme }),

      // Calendar events
      addCalendarEvent: (ev) => set((s) => ({ calendarEvents: [...s.calendarEvents, { ...ev, id: nanoid() }] })),
      updateCalendarEvent: (id, data) => set((s) => ({ calendarEvents: s.calendarEvents.map((e) => e.id === id ? { ...e, ...data } : e) })),
      removeCalendarEvent: (id) => { queueDelete('calendar_events', id); set((s) => ({ calendarEvents: s.calendarEvents.filter((e) => e.id !== id) })) },

      // Heritage - Ancestors
      addAncestor: (a) => set((s) => ({ ancestors: [...s.ancestors, { ...a, id: nanoid() }] })),
      updateAncestor: (id, data) => set((s) => ({ ancestors: s.ancestors.map((a) => a.id === id ? { ...a, ...data } : a) })),
      removeAncestor: (id) => {
        queueDelete('ancestors', id)
        // Cascade: queue deletion of anniversaries linked to this ancestor
        get().anniversaries.filter((ann) => ann.ancestorId === id).forEach((ann) => queueDelete('anniversaries', ann.id))
        set((s) => ({
          ancestors: s.ancestors.filter((a) => a.id !== id),
          anniversaries: s.anniversaries.filter((ann) => ann.ancestorId !== id),
        }))
      },

      // Heritage - Anniversaries
      addAnniversary: (ann) => set((s) => ({ anniversaries: [...s.anniversaries, { ...ann, id: nanoid() }] })),
      updateAnniversary: (id, data) => set((s) => ({ anniversaries: s.anniversaries.map((a) => a.id === id ? { ...a, ...data } : a) })),
      removeAnniversary: (id) => { queueDelete('anniversaries', id); set((s) => ({ anniversaries: s.anniversaries.filter((a) => a.id !== id) })) },
    }),
    {
      name: 'family-hub-v1',
      version: 6,
      // Strip heavy base64 fields before writing to localStorage. iOS Safari
      // caps localStorage at ~5MB; photo dataUrls, avatars, and ancestor
      // photos easily blow that. Everything stripped here lives on Supabase
      // and hydrates back into memory on the next sync load (typically <2s
      // after auth). The in-memory state is untouched — only persistence is
      // slimmed down.
      partialize: (state) => ({
        ...state,
        photos: [],
        members: state.members.map(({ avatarUrl: _drop, ...m }) => m),
        ancestors: state.ancestors.map(({ photoUrl: _drop, ...a }) => a),
      }),
      migrate: (persisted: any, version: number) => {
        if (version === 0) {
          return { ...persisted, pin: '1234', isAuthenticated: false }
        }
        if (version < 2) {
          return {
            ...persisted,
            familyCode: `fam-${persisted.pin || '1234'}`,
            ancestors: SEED_ANCESTORS,
            anniversaries: SEED_ANNIVERSARIES,
          }
        }
        if (version < 3) {
          if (persisted.pin && !persisted.familyCode?.startsWith('fam-')) {
            return { ...persisted, familyCode: `fam-${persisted.pin}` }
          }
        }
        // v4: Free up localStorage by dropping the heavy base64 fields from
        // any pre-existing persisted state. They re-hydrate from Supabase
        // on the next sync. Applied unconditionally so users currently at
        // quota get relief on the very next page load.
        if (version < 4) {
          persisted = {
            ...persisted,
            photos: [],
            members: (persisted.members ?? []).map(({ avatarUrl: _drop, ...m }: any) => m),
            ancestors: (persisted.ancestors ?? []).map(({ photoUrl: _drop, ...a }: any) => a),
          }
        }
        // v5: Refresh the seed vocab. Old devices have ~30 legacy seed words
        // (IDs like "v1"–"v30") on Supabase that override the new 1200-word
        // dataset on every load. Replace those with VOCAB_DATA while
        // preserving any word the user added themselves (nanoid IDs).
        if (version < 5) {
          const prevVocab: any[] = persisted.vocabWords ?? []
          const isLegacySeed = (id: string) => /^v\d+$/.test(id)
          const isNewSeed = (id: string) => id.startsWith('v-')
          const userAdded = prevVocab.filter(
            (v) => !isLegacySeed(v.id) && !isNewSeed(v.id)
          )
          persisted = { ...persisted, vocabWords: [...VOCAB_DATA, ...userAdded] }
        }
        // v6: vocab is no longer sync'd via Supabase. Devices that hit the
        // emoji-column upsert failure + orphan-cleanup wipe + freshLoad
        // pruner cascade ended up with vocabWords = []. Re-seed from
        // VOCAB_DATA, preserving any nanoid-ID user additions if the array
        // still holds them.
        if (version < 6) {
          const prevVocab: any[] = persisted.vocabWords ?? []
          const isLegacySeed = (id: string) => /^v\d+$/.test(id)
          const isNewSeed = (id: string) => id.startsWith('v-')
          const userAdded = prevVocab.filter(
            (v) => !isLegacySeed(v.id) && !isNewSeed(v.id)
          )
          persisted = { ...persisted, vocabWords: [...VOCAB_DATA, ...userAdded] }
        }
        return persisted
      },
    }
  )
)
