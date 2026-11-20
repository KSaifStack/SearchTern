import { createContext, lazy, Suspense, useCallback, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from './AuthContext'
import {
  accountProfile, loadLocalProfile, saveAccountProfile, saveLocalProfile,
} from '../utils/forYou'
import type { ForYouProfile } from '../utils/forYou'
import { syncDigest } from '../api/forYou'
// Lazy: the modal pulls in resume storage (and pdf.js) via its PDF upload step.
const ForYouOnboarding = lazy(() => import('./ForYouOnboarding'))

interface ForYouContextType {
  /** Signed-in user, or a dev-only guest under `npm run dev`. */
  actorId: string | null
  profile: ForYouProfile | null
  saveProfile: (p: ForYouProfile) => Promise<{ ok: true } | { ok: false; error: string }>
  openOnboarding: () => void
}

const ForYouContext = createContext<ForYouContextType | undefined>(undefined)

export function ForYouProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  // Same dev-only guest fallback as the Agent hub: local dev can walk the
  // whole flow without Supabase; production requires a real session.
  const actorId = user?.id ?? (import.meta.env.DEV ? 'local' : null)
  // Just-saved profile wins until the account metadata catches up.
  const [saved, setSaved] = useState<ForYouProfile | null>(null)
  const [local] = useState<ForYouProfile | null>(() => loadLocalProfile())
  const profile = saved ?? (user ? accountProfile(user) : null) ?? local

  // For You is a drawer on the Internships page, so the questions are only
  // asked when someone opens it — an unrequested modal on the listings page
  // was worse than a "Set up your feed" button.
  const [open, setOpen] = useState(false)

  const saveProfile = useCallback(async (p: ForYouProfile) => {
    setSaved(p)
    saveLocalProfile(p)
    if (!user) return { ok: true } as const
    await saveAccountProfile(p)
    return syncDigest(user.id, user.email ?? p.email, p)
  }, [user])

  return (
    <ForYouContext.Provider value={{ actorId, profile, saveProfile, openOnboarding: () => setOpen(true) }}>
      {children}
      {open && actorId && (
        <Suspense fallback={null}>
        <ForYouOnboarding
          initial={profile}
          defaultEmail={user?.email ?? ''}
          onClose={() => setOpen(false)}
          onSave={async p => {
            setOpen(false)
            return saveProfile(p)
          }}
        />
        </Suspense>
      )}
    </ForYouContext.Provider>
  )
}

export function useForYou() {
  const ctx = useContext(ForYouContext)
  if (!ctx) throw new Error('useForYou must be used within ForYouProvider')
  return ctx
}
