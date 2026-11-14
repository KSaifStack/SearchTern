import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

/**
 * Saved filter/sort settings for the Internships page.
 *
 * Guests keep them in localStorage. Signed-in users also get a copy in their
 * Supabase user_metadata, so the settings follow them across devices without
 * needing a new table or migration. The free-text search box is deliberately
 * not saved: it is a one-off query, not a preference.
 */
export interface JobFilterPrefs {
  sortOrder: string
  categoryFilters: string[]
  typeFilters: { internship: boolean; newgrad: boolean }
  countryFilter: string
  stateFilter: string
  faangOnly: boolean
  visaSponsorOnly: boolean
  employeeBucket: string
  recencyDays: number
  hideStale: boolean
}

export const DEFAULT_JOB_FILTERS: JobFilterPrefs = {
  sortOrder: 'newest',
  categoryFilters: [],
  typeFilters: { internship: true, newgrad: true },
  countryFilter: '',
  stateFilter: '',
  faangOnly: false,
  visaSponsorOnly: false,
  employeeBucket: '',
  recencyDays: 0,
  hideStale: false,
}

const LS_KEY = 'searchtern-job-filters'
// Before this module, only "hide stale" was remembered, under its own key.
const LEGACY_HIDE_STALE_KEY = 'searchtern-hide-stale'
const META_KEY = 'jobFilters'

const SORTS = new Set(['newest', 'oldest', 'company-az', 'company-za'])

const str = (v: unknown, d: string) => (typeof v === 'string' ? v : d)
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d)

/**
 * Both storage locations are editable by the user (devtools, another client),
 * so every field is type-checked and anything malformed falls back to its
 * default instead of breaking the page.
 */
function sanitize(raw: unknown): JobFilterPrefs | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const d = DEFAULT_JOB_FILTERS
  const types = (r.typeFilters && typeof r.typeFilters === 'object' ? r.typeFilters : {}) as Record<string, unknown>
  const sortOrder = str(r.sortOrder, d.sortOrder)
  const recency = typeof r.recencyDays === 'number' && Number.isFinite(r.recencyDays) && r.recencyDays >= 0
    ? r.recencyDays
    : d.recencyDays
  return {
    sortOrder: SORTS.has(sortOrder) ? sortOrder : d.sortOrder,
    categoryFilters: Array.isArray(r.categoryFilters)
      ? r.categoryFilters.filter((c): c is string => typeof c === 'string')
      : d.categoryFilters,
    typeFilters: {
      internship: bool(types.internship, d.typeFilters.internship),
      newgrad: bool(types.newgrad, d.typeFilters.newgrad),
    },
    countryFilter: str(r.countryFilter, d.countryFilter),
    stateFilter: str(r.stateFilter, d.stateFilter),
    faangOnly: bool(r.faangOnly, d.faangOnly),
    visaSponsorOnly: bool(r.visaSponsorOnly, d.visaSponsorOnly),
    employeeBucket: str(r.employeeBucket, d.employeeBucket),
    recencyDays: recency,
    hideStale: bool(r.hideStale, d.hideStale),
  }
}

export function loadLocalJobFilters(): JobFilterPrefs {
  try {
    const saved = sanitize(JSON.parse(localStorage.getItem(LS_KEY) || 'null'))
    if (saved) return saved
    return { ...DEFAULT_JOB_FILTERS, hideStale: localStorage.getItem(LEGACY_HIDE_STALE_KEY) === '1' }
  } catch {
    // Private mode / blocked storage / corrupt JSON: use defaults.
    return DEFAULT_JOB_FILTERS
  }
}

export function saveLocalJobFilters(prefs: JobFilterPrefs): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(prefs))
    localStorage.removeItem(LEGACY_HIDE_STALE_KEY)
  } catch {
    // Preferences just won't survive the session.
  }
}

/** The copy saved on the user's account, or null if they never saved one. */
export function accountJobFilters(user: User): JobFilterPrefs | null {
  return sanitize(user.user_metadata?.[META_KEY])
}

/**
 * updateUser merges `data` into the existing user_metadata, so this leaves
 * name/avatar/etc. from Google sign-in untouched.
 */
export async function saveAccountJobFilters(prefs: JobFilterPrefs): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.auth.updateUser({ data: { [META_KEY]: prefs } })
  if (error) console.error('Error saving filter settings to account:', error)
}

export function sameJobFilters(a: JobFilterPrefs | null, b: JobFilterPrefs | null): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}
