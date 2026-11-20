import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

/**
 * "For You" profile: the onboarding answers that drive the curated feed and the
 * optional daily match email.
 *
 * Like jobFilterPrefs, guests keep it in localStorage and signed-in users also
 * get a copy in Supabase user_metadata. Only the matching fields (never phone,
 * links or the resume) are sent to the backend for the email digest.
 *
 * The matching tables and scoring below are mirrored in backend/foryou.py.
 * Keep the two in sync so the email picks what the page shows first.
 */

export type WorkAuth = 'citizen' | 'permanent_resident' | 'f1_opt' | 'h1b' | 'other_sponsor' | ''

export interface ForYouProfile {
  college: string
  /** YYYY-MM */
  gradMonth: string
  /** Name of the resume in resumeStorage, if one was attached. */
  resumeName: string
  metros: string[]
  remoteOk: boolean
  roles: string[]
  jobTypes: string[]
  email: string
  phone: string
  linkedin: string
  links: string[]
  workAuth: WorkAuth
  digestOptIn: boolean
  /** How many matches the daily email lists, 1–5. */
  dailyCount: number
  completedAt: string
}

export const EMPTY_PROFILE: ForYouProfile = {
  college: '',
  gradMonth: '',
  resumeName: '',
  metros: [],
  remoteOk: true,
  roles: [],
  jobTypes: [],
  email: '',
  phone: '',
  linkedin: '',
  links: [],
  workAuth: '',
  digestOptIn: false,
  dailyCount: 5,
  completedAt: '',
}

export interface RoleOption { value: string; label: string; categories: string[]; keywords: RegExp }

// `categories` are the scraper's category labels; `keywords` catch listings
// the classifier left uncategorized (roughly a fifth of the feed).
export const ROLE_OPTIONS: RoleOption[] = [
  { value: 'swe', label: 'Software Development', categories: ['Software Engineering'], keywords: /\b(software|swe|developer|full[- ]?stack|front[- ]?end|back[- ]?end|mobile|ios|android|web)\b/i },
  { value: 'ai', label: 'AI / Machine Learning', categories: ['Data/ML/AI'], keywords: /\b(machine learning|ml|ai|artificial intelligence|deep learning|llm|nlp|computer vision)\b/i },
  { value: 'data', label: 'Data Analysis / Science', categories: ['Data/ML/AI', 'Business/Analytics'], keywords: /\b(data|analytics|analyst|business intelligence|bi)\b/i },
  { value: 'security', label: 'Cybersecurity', categories: ['Cybersecurity'], keywords: /\b(security|cyber|infosec|soc)\b/i },
  { value: 'devops', label: 'DevOps / Cloud / SRE', categories: ['DevOps/SRE'], keywords: /\b(devops|sre|site reliability|cloud|infrastructure|platform)\b/i },
  { value: 'hardware', label: 'Hardware / Embedded', categories: ['Hardware/Embedded'], keywords: /\b(hardware|embedded|firmware|electrical|fpga|asic|robotics)\b/i },
  { value: 'product', label: 'Product / Design', categories: ['Product/Design'], keywords: /\b(product|ux|ui|designer|design)\b/i },
  { value: 'quant', label: 'Quant / Finance', categories: ['Finance/Quant', 'Accounting'], keywords: /\b(quant|quantitative|trading|finance|financial|investment)\b/i },
  { value: 'research', label: 'Research / Science', categories: ['Research/Science'], keywords: /\b(research|scientist|r&d)\b/i },
  { value: 'business', label: 'Business / Operations', categories: ['Operations/Supply', 'Sales/Business Dev', 'Marketing/Comms'], keywords: /\b(operations|business|marketing|sales|consult)\b/i },
]

export const JOB_TYPE_OPTIONS = [
  { value: 'summer', label: 'Summer internship' },
  { value: 'fall', label: 'Fall internship' },
  { value: 'spring', label: 'Spring internship' },
  { value: 'winter', label: 'Winter internship' },
  { value: 'coop', label: 'Co-op' },
  { value: 'newgrad', label: 'New grad (full-time)' },
]

export const WORK_AUTH_OPTIONS: { value: WorkAuth; label: string; needsSponsor: boolean }[] = [
  { value: 'citizen', label: 'U.S. citizen', needsSponsor: false },
  { value: 'permanent_resident', label: 'Permanent resident (green card)', needsSponsor: false },
  { value: 'f1_opt', label: 'F-1 student (CPT / OPT / STEM OPT)', needsSponsor: true },
  { value: 'h1b', label: 'H-1B (need transfer / sponsorship)', needsSponsor: true },
  { value: 'other_sponsor', label: 'Other visa, will need sponsorship', needsSponsor: true },
]

export const DAILY_COUNT_MIN = 1
export const DAILY_COUNT_MAX = 5

/** The daily email lists 1–5 matches; anything else falls back to 5. */
export function clampDailyCount(v: unknown): number {
  const n = Math.round(Number(v))
  if (!Number.isFinite(n)) return DAILY_COUNT_MAX
  return Math.min(DAILY_COUNT_MAX, Math.max(DAILY_COUNT_MIN, n))
}

export function needsSponsorship(auth: WorkAuth): boolean {
  return WORK_AUTH_OPTIONS.some(o => o.value === auth && o.needsSponsor)
}

/** Metro label -> lowercase city names a listing's location is matched against. */
export const METROS: Record<string, string[]> = {
  'New York City, NY': ['new york', 'nyc', 'brooklyn', 'manhattan', 'jersey city', 'hoboken', 'newark', 'stamford'],
  'San Francisco Bay Area, CA': ['san francisco', 'san jose', 'palo alto', 'mountain view', 'sunnyvale', 'menlo park', 'santa clara', 'cupertino', 'redwood city', 'oakland', 'fremont', 'san mateo', 'foster city', 'milpitas', 'berkeley', 'south san francisco'],
  'Seattle, WA': ['seattle', 'bellevue', 'redmond', 'kirkland', 'tacoma', 'bothell'],
  'Los Angeles, CA': ['los angeles', 'santa monica', 'irvine', 'pasadena', 'culver city', 'el segundo', 'long beach', 'burbank', 'torrance', 'hawthorne'],
  'San Diego, CA': ['san diego', 'la jolla', 'carlsbad'],
  'Boston, MA': ['boston', 'cambridge', 'waltham', 'somerville', 'burlington, ma', 'lexington, ma'],
  'Chicago, IL': ['chicago', 'evanston', 'naperville', 'schaumburg'],
  'Austin, TX': ['austin', 'round rock'],
  'Dallas-Fort Worth, TX': ['dallas', 'fort worth', 'plano', 'irving', 'richardson', 'frisco', 'arlington, tx'],
  'Houston, TX': ['houston', 'the woodlands', 'sugar land'],
  'Washington, DC Metro': ['washington, dc', 'washington dc', 'washington, d.c.', 'arlington, va', 'mclean', 'reston', 'herndon', 'tysons', 'alexandria', 'bethesda', 'rockville', 'chantilly', 'fairfax'],
  'Atlanta, GA': ['atlanta', 'alpharetta', 'marietta'],
  'Denver / Boulder, CO': ['denver', 'boulder', 'englewood', 'aurora, co', 'colorado springs'],
  'Philadelphia, PA': ['philadelphia', 'king of prussia', 'conshohocken'],
  'Pittsburgh, PA': ['pittsburgh'],
  'Raleigh-Durham, NC': ['raleigh', 'durham', 'chapel hill', 'cary', 'morrisville', 'research triangle'],
  'Charlotte, NC': ['charlotte'],
  'Miami, FL': ['miami', 'fort lauderdale', 'boca raton'],
  'Orlando / Tampa, FL': ['orlando', 'tampa', 'st. petersburg'],
  'Phoenix, AZ': ['phoenix', 'tempe', 'scottsdale', 'chandler', 'mesa'],
  'Salt Lake City, UT': ['salt lake city', 'lehi', 'provo', 'draper', 'south jordan'],
  'Portland, OR': ['portland, or', 'hillsboro', 'beaverton'],
  'Minneapolis-St. Paul, MN': ['minneapolis', 'st. paul', 'saint paul', 'eden prairie'],
  'Detroit / Ann Arbor, MI': ['detroit', 'ann arbor', 'dearborn', 'troy, mi'],
  'Columbus, OH': ['columbus'],
  'Nashville, TN': ['nashville', 'franklin, tn'],
  'St. Louis, MO': ['st. louis', 'st louis', 'saint louis'],
  'Kansas City, MO': ['kansas city', 'overland park'],
  'Baltimore, MD': ['baltimore', 'columbia, md', 'annapolis', 'laurel, md'],
  'Huntsville, AL': ['huntsville'],
}
export const METRO_OPTIONS = Object.keys(METROS)

// ── Storage ──────────────────────────────────────────────────────────────────

const LS_KEY = 'searchtern-foryou-profile'
const LS_DISMISSED = 'searchtern-foryou-dismissed'
const META_KEY = 'forYou'

const str = (v: unknown) => (typeof v === 'string' ? v.trim().slice(0, 300) : '')
const strList = (v: unknown, allowed?: Set<string>) =>
  Array.isArray(v)
    ? [...new Set(v.map(str).filter(s => s && (!allowed || allowed.has(s))))].slice(0, 12)
    : []

/** Both copies are user-editable, so every field is type-checked. */
function sanitize(raw: unknown): ForYouProfile | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const completedAt = str(r.completedAt)
  if (!completedAt) return null
  const auth = str(r.workAuth) as WorkAuth
  return {
    college: str(r.college),
    gradMonth: /^\d{4}-\d{2}$/.test(str(r.gradMonth)) ? str(r.gradMonth) : '',
    resumeName: str(r.resumeName),
    metros: strList(r.metros, new Set(METRO_OPTIONS)),
    remoteOk: typeof r.remoteOk === 'boolean' ? r.remoteOk : true,
    roles: strList(r.roles, new Set(ROLE_OPTIONS.map(o => o.value))),
    jobTypes: strList(r.jobTypes, new Set(JOB_TYPE_OPTIONS.map(o => o.value))),
    email: str(r.email),
    phone: str(r.phone),
    linkedin: str(r.linkedin),
    links: strList(r.links),
    workAuth: WORK_AUTH_OPTIONS.some(o => o.value === auth) ? auth : '',
    digestOptIn: r.digestOptIn === true,
    dailyCount: clampDailyCount(r.dailyCount),
    completedAt,
  }
}

export function loadLocalProfile(): ForYouProfile | null {
  try {
    return sanitize(JSON.parse(localStorage.getItem(LS_KEY) || 'null'))
  } catch {
    return null
  }
}

export function saveLocalProfile(p: ForYouProfile): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(p))
  } catch {
    // Profile just won't survive the session.
  }
}

export function accountProfile(user: User): ForYouProfile | null {
  return sanitize(user.user_metadata?.[META_KEY])
}

export async function saveAccountProfile(p: ForYouProfile): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.auth.updateUser({ data: { [META_KEY]: p } })
  if (error) console.error('Error saving For You profile to account:', error)
}

export function onboardingDismissed(): boolean {
  try { return localStorage.getItem(LS_DISMISSED) === '1' } catch { return false }
}

export function dismissOnboarding(): void {
  try { localStorage.setItem(LS_DISMISSED, '1') } catch { /* ignore */ }
}

// ── Matching ─────────────────────────────────────────────────────────────────

export interface MatchableJob {
  company: string
  role: string
  location?: string
  date: number | string
  type?: string
  season?: string
  category?: string | null
  visa_sponsor?: boolean
}

export interface Match<J> { job: J; score: number; reasons: string[] }

const SEASON_PATTERNS: Record<string, RegExp> = {
  summer: /\bsummer\b/i,
  fall: /\b(fall|autumn)\b/i,
  spring: /\bspring\b/i,
  winter: /\bwinter\b/i,
  coop: /\bco-?op\b/i,
}

function roleMatch(job: MatchableJob, roles: string[]): RoleOption | null {
  for (const opt of ROLE_OPTIONS) {
    if (!roles.includes(opt.value)) continue
    if (job.category && opt.categories.includes(job.category)) return opt
    if (opt.keywords.test(job.role)) return opt
  }
  return null
}

/** null = excluded; otherwise points and a reason, if any. */
function typeMatch(job: MatchableJob, types: string[]): { points: number; reason?: string } | null {
  if (types.length === 0) return { points: 0 }
  if (job.type === 'newgrad') {
    return types.includes('newgrad') ? { points: 2, reason: 'New grad' } : null
  }
  const internTypes = types.filter(t => t !== 'newgrad')
  if (internTypes.length === 0) return null
  const explicit = Object.keys(SEASON_PATTERNS).filter(k => SEASON_PATTERNS[k].test(job.role))
  // Simplify's season feeds are summer programs even when the title doesn't say so.
  if (/^\d{4}$/.test(job.season ?? '') && !explicit.length) explicit.push('summer')
  if (explicit.length === 0) return { points: 0 }
  const hit = explicit.find(k => internTypes.includes(k))
  if (!hit) return null
  return { points: 2, reason: JOB_TYPE_OPTIONS.find(o => o.value === hit)?.label }
}

function metroMatch(location: string, metros: string[], remoteOk: boolean): { points: number; reason?: string } | null {
  const loc = location.toLowerCase()
  for (const metro of metros) {
    if (METROS[metro].some(city => loc.includes(city))) return { points: 2, reason: metro.split(',')[0] }
  }
  if (remoteOk && /\bremote\b/.test(loc)) return { points: 1, reason: 'Remote' }
  return metros.length === 0 ? { points: 0 } : null
}

export function scoreJob<J extends MatchableJob>(job: J, p: ForYouProfile): Match<J> | null {
  const reasons: string[] = []
  let score = 0

  if (p.roles.length) {
    const role = roleMatch(job, p.roles)
    if (!role) return null
    score += 3
    reasons.push(role.label)
  }

  const type = typeMatch(job, p.jobTypes)
  if (!type) return null
  score += type.points
  if (type.reason) reasons.push(type.reason)

  const loc = metroMatch(job.location ?? '', p.metros, p.remoteOk)
  if (!loc) return null
  score += loc.points
  if (loc.reason) reasons.push(loc.reason)

  if (needsSponsorship(p.workAuth) && job.visa_sponsor === true) {
    score += 2
    reasons.push('Sponsors H-1B')
  }

  const days = parseFloat(String(job.date))
  if (Number.isFinite(days)) {
    if (days <= 1) { score += 2; reasons.push('New today') }
    else if (days <= 7) { score += 1; reasons.push('This week') }
  }

  return { job, score, reasons }
}

export function rankJobs<J extends MatchableJob>(jobs: J[], p: ForYouProfile, limit = 50): Match<J>[] {
  const out: Match<J>[] = []
  for (const job of jobs) {
    const m = scoreJob(job, p)
    if (m) out.push(m)
  }
  out.sort((a, b) =>
    b.score - a.score ||
    parseFloat(String(a.job.date)) - parseFloat(String(b.job.date))
  )
  return out.slice(0, limit)
}

/** The subset of the profile the backend needs to pick a daily email match. */
export function digestPayload(p: ForYouProfile) {
  return {
    roles: p.roles,
    jobTypes: p.jobTypes,
    metros: p.metros,
    remoteOk: p.remoteOk,
    workAuth: p.workAuth,
    dailyCount: p.dailyCount,
  }
}
