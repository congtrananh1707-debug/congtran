export type MemberRole =
  | 'dad'               // Bố
  | 'mom'               // Mẹ
  | 'child'             // Con
  | 'grandpa_paternal'  // Ông nội
  | 'grandma_paternal'  // Bà nội
  | 'grandpa_maternal'  // Ông ngoại
  | 'grandma_maternal'  // Bà ngoại
  | 'uncle'             // Chú/Bác
  | 'aunt'              // Cô/Dì
  | 'sibling'           // Anh/Chị/Em
  | 'other'             // Khác

export const ROLE_CONFIG: Record<MemberRole, { label: string; emoji: string; isParent: boolean }> = {
  dad:              { label: 'Bố',         emoji: '👨',  isParent: true  },
  mom:              { label: 'Mẹ',         emoji: '👩',  isParent: true  },
  child:            { label: 'Con',        emoji: '🧒',  isParent: false },
  grandpa_paternal: { label: 'Ông nội',   emoji: '👴',  isParent: true  },
  grandma_paternal: { label: 'Bà nội',    emoji: '👵',  isParent: true  },
  grandpa_maternal: { label: 'Ông ngoại', emoji: '👴',  isParent: true  },
  grandma_maternal: { label: 'Bà ngoại',  emoji: '👵',  isParent: true  },
  uncle:            { label: 'Chú/Bác',   emoji: '🧔',  isParent: false },
  aunt:             { label: 'Cô/Dì',     emoji: '👱‍♀️', isParent: false },
  sibling:          { label: 'Anh/Chị/Em', emoji: '🧑', isParent: false },
  other:            { label: 'Khác',       emoji: '🧑', isParent: false },
}

export const isParentRole = (role: MemberRole): boolean => ROLE_CONFIG[role]?.isParent ?? false

export type Member = {
  id: string
  name: string
  role: MemberRole
  emoji: string
  color: string
  birthday: string
  bloodType: string
  favoriteFoods: string[]
  allergies: string[]
  goals: string[]
  tokens: number
  avatarUrl?: string
}

export type HealthRecord = {
  id: string
  memberId: string
  date: string
  height: number
  weight: number
}

export type SkillCategory = 'academics' | 'sports' | 'softSkills' | 'arts' | 'social'

export type SkillNode = {
  id: string
  memberId: string
  category: SkillCategory
  name: string
  icon: string
  achieved: boolean
  achievedDate?: string
}

export type QuestType = 'daily' | 'special' | 'family'
export type QuestStatus = 'active' | 'pending' | 'approved' | 'rejected'

export type Quest = {
  id: string
  title: string
  description: string
  type: QuestType
  tokens: number
  assignedTo: string[]
  status: QuestStatus
  createdBy: string
  completedBy?: string
  completedAt?: number
  flashDeadline?: number
}

export type Reward = {
  id: string
  name: string
  emoji: string
  tokenCost: number
  active: boolean
}

export type MoodTag = 'happy' | 'sad' | 'scared' | 'angry' | 'excited' | 'love'
export type MailReaction = 'heart' | 'hug' | 'icecream' | 'star' | 'laugh'

export type MailReply = {
  id: string
  from: string
  body: string
  reaction?: MailReaction
  timestamp: number
}

export type MailMessage = {
  id: string
  from: string
  to: string[]
  subject: string
  body: string
  mood: MoodTag
  timestamp: number
  readBy: string[]
  reactions: { memberId: string; type: MailReaction }[]
  replies: MailReply[]
}

export type GratitudeNote = {
  id: string
  from: string
  to: string
  message: string
  color: string
  timestamp: number
}

export type WheelItem = {
  id: string
  category: 'activity' | 'menu'
  label: string
  emoji: string
}

export type QuizQuestion = {
  id: string
  question: string
  answers: string[]
  correctIndex: number
  createdBy: string
}

export type FamilyQuest = {
  id: string
  title: string
  description: string
  targetDays: number
  currentDays: number
  startDate: string
  active: boolean
}

export type Photo = {
  id: string
  albumId: string
  dataUrl: string
  caption: string
  taggedMembers: string[]
  date: string
}

export type Album = {
  id: string
  title: string
  date: string
  coverEmoji: string
  description: string
}

export type SilentHero = {
  id: string
  memberId: string
  loggedBy: string
  deed: string
  timestamp: number
  reactions: { memberId: string; emoji: string }[]
}

export type VocabWord = {
  id: string
  word: string
  translation: string
  example: string
  theme: string
  masteredBy: string[]
}

export type CalendarEvent = {
  id: string
  title: string
  date: string
  emoji: string
  color: string
  createdBy: string
}

// ─── Heritage types ────────────────────────────────────────────────────────────

export type Ancestor = {
  id: string
  name: string
  gender: 'male' | 'female'
  relationship: string      // free text: 'Ông nội', 'Cụ nội', etc.
  birthYear?: number
  deathYear?: number
  solarBirthDate?: string   // YYYY-MM-DD
  solarDeathDate?: string   // YYYY-MM-DD
  lunarDeathDay?: number    // 1-30
  lunarDeathMonth?: number  // 1-12
  biography?: string
  photoUrl?: string
  parentIds: string[]       // IDs of parent ancestors in the tree
  spouseId?: string
}

export type Anniversary = {
  id: string
  name: string              // 'Giỗ Ông nội', 'Giỗ Cụ bà'...
  ancestorId?: string       // linked ancestor (optional)
  solarDate?: string        // YYYY-MM-DD for upcoming calc
  lunarDay: number          // 1-30
  lunarMonth: number        // 1-12
  notes?: string
}

// ─── App views ────────────────────────────────────────────────────────────────

export type AppView =
  | 'dashboard'
  | 'profiles'
  | 'profile'
  | 'quests'
  | 'rewards'
  | 'mailbox'
  | 'gratitude'
  | 'wheel'
  | 'quiz'
  | 'memory'
  | 'settings'
  | 'english'
  | 'calendar'
  | 'heroes'
  | 'heritage'

// ─── Constants ────────────────────────────────────────────────────────────────

export const SKILL_CATEGORIES: { key: SkillCategory; label: string; icon: string; color: string }[] = [
  { key: 'academics',  label: 'Học tập',      icon: '📚', color: 'text-blue-500'   },
  { key: 'sports',     label: 'Thể thao',     icon: '⚽', color: 'text-green-500'  },
  { key: 'softSkills', label: 'Kỹ năng sống', icon: '🤝', color: 'text-purple-500' },
  { key: 'arts',       label: 'Nghệ thuật',   icon: '🎨', color: 'text-pink-500'   },
  { key: 'social',     label: 'Xã hội',       icon: '💬', color: 'text-orange-500' },
]

export const MOOD_CONFIG: Record<MoodTag, { label: string; emoji: string; color: string }> = {
  happy:   { label: 'Vui vẻ',     emoji: '😊', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  sad:     { label: 'Buồn',       emoji: '😢', color: 'bg-blue-100 text-blue-700 border-blue-300'       },
  scared:  { label: 'Sợ hãi',     emoji: '😨', color: 'bg-purple-100 text-purple-700 border-purple-300' },
  angry:   { label: 'Tức giận',   emoji: '😠', color: 'bg-red-100 text-red-700 border-red-300'          },
  excited: { label: 'Hào hứng',   emoji: '🤩', color: 'bg-orange-100 text-orange-700 border-orange-300' },
  love:    { label: 'Yêu thương', emoji: '🥰', color: 'bg-pink-100 text-pink-700 border-pink-300'       },
}

export const REACTION_CONFIG: Record<MailReaction, { label: string; emoji: string }> = {
  heart:    { label: 'Yêu',  emoji: '❤️' },
  hug:      { label: 'Ôm',   emoji: '🤗' },
  icecream: { label: 'Kem',  emoji: '🍦' },
  star:     { label: 'Sao',  emoji: '⭐' },
  laugh:    { label: 'Haha', emoji: '😂' },
}

export const NOTE_COLORS = [
  'bg-yellow-200 border-yellow-300',
  'bg-pink-200 border-pink-300',
  'bg-green-200 border-green-300',
  'bg-blue-200 border-blue-300',
  'bg-purple-200 border-purple-300',
  'bg-orange-200 border-orange-300',
]

export const ENGLISH_THEMES = ['kitchen', 'nature', 'animals', 'school', 'family', 'space']
export const ENGLISH_THEME_LABELS: Record<string, { label: string; emoji: string }> = {
  kitchen: { label: 'Nhà bếp',     emoji: '🍳' },
  nature:  { label: 'Thiên nhiên', emoji: '🌿' },
  animals: { label: 'Động vật',    emoji: '🐾' },
  school:  { label: 'Trường học',  emoji: '🏫' },
  family:  { label: 'Gia đình',    emoji: '👨‍👩‍👧' },
  space:   { label: 'Vũ trụ',      emoji: '🚀' },
}
