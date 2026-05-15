import { useState } from 'react'
import { useStore } from './store/useStore'
import { useSupabaseSync } from './hooks/useSupabaseSync'
import PinLogin from './components/auth/PinLogin'
import MemberSelect from './components/auth/MemberSelect'
import AppLayout from './components/layout/AppLayout'
import Dashboard from './components/dashboard/Dashboard'
import ProfileList from './components/profiles/ProfileList'
import ProfilePage from './components/profiles/ProfilePage'
import QuestLog from './components/quests/QuestLog'
import RewardShop from './components/quests/RewardShop'
import SecretMailbox from './components/mailbox/SecretMailbox'
import GratitudeWall from './components/gratitude/GratitudeWall'
import MagicWheel from './components/activities/MagicWheel'
import FamilyQuiz from './components/activities/FamilyQuiz'
import MemoryAlbums from './components/memory/MemoryAlbums'
import Settings from './components/settings/Settings'
import EnglishAdventure from './components/english/EnglishAdventure'
import FamilyCalendar from './components/calendar/FamilyCalendar'
import SilentHeroes from './components/heroes/SilentHeroes'
import HeritageView from './components/heritage/HeritageView'
import ErrorBoundary from './components/ui/ErrorBoundary'
import type { AppView } from './types'

export default function App() {
  const isAuthenticated = useStore((s) => s.isAuthenticated)
  const currentMemberId = useStore((s) => s.currentMemberId)

  const [view, setView]         = useState<AppView>('dashboard')
  const [profileId, setProfileId] = useState<string>('')

  // Supabase realtime sync (no-op if not configured)
  useSupabaseSync()

  if (!isAuthenticated) return <PinLogin />
  if (!currentMemberId) return <MemberSelect />

  const navigate = (v: AppView) => setView(v)

  const renderPage = () => {
    switch (view) {
      case 'dashboard': return <Dashboard setView={navigate} setProfileId={setProfileId} />
      case 'profiles':  return <ProfileList onSelect={(id) => { setProfileId(id); setView('profile') }} />
      case 'profile':   return <ProfilePage memberId={profileId} onBack={() => setView('profiles')} />
      case 'quests':    return <QuestLog />
      case 'rewards':   return <RewardShop />
      case 'mailbox':   return <SecretMailbox />
      case 'gratitude': return <GratitudeWall />
      case 'wheel':     return <MagicWheel />
      case 'quiz':      return <FamilyQuiz />
      case 'memory':    return <MemoryAlbums />
      case 'english':   return <EnglishAdventure />
      case 'calendar':  return <FamilyCalendar />
      case 'heroes':    return <SilentHeroes />
      case 'heritage':  return <HeritageView />
      case 'settings':  return <Settings />
      default:          return <Dashboard setView={navigate} setProfileId={setProfileId} />
    }
  }

  return (
    <AppLayout view={view} setView={navigate} profileId={profileId} setProfileId={setProfileId}>
      <ErrorBoundary key={view}>
        {renderPage()}
      </ErrorBoundary>
    </AppLayout>
  )
}
