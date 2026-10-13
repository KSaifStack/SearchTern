// Resolves a company name to its real domain via Clearbit autocomplete, so
// favicons don't guess "x.com" (TIAA -> tiaa.org, not tiaa.com).
// Feed names are often noisy ("American Family Insurance Group", "Rtx
// Raytheon"), so the exact name is tried first, then a suffix-stripped and a
// first-word variant. Each variant only fires when the previous found nothing.
// ponytail: third-party autocomplete per unique company; memoized in memory
// and localStorage so each browser hits it once per company per session.
const MEMORY: Record<string, string | null> = {}
const PENDING: Record<string, Promise<string | null>> = {}
const STORE_KEY = 'searchtern-company-domains'

function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // "AtkinsRéalis" -> "AtkinsRealis"
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function loadStore(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || '{}')
  } catch {
    return {}
  }
}

// Sync lookup: resolved domain, null if unknown, cached-failure, or in-flight.
export function getCompanyDomain(company: string): string | null {
  if (company in MEMORY) return MEMORY[company]
  const store = loadStore()
  if (store[company]) {
    MEMORY[company] = store[company]
    return store[company]
  }
  return null
}

// Async resolution; resolves immediately if already known.
export function awaitCompanyDomain(company: string): Promise<string | null> {
  const known = getCompanyDomain(company)
  if (known) return Promise.resolve(known)
  if (company in MEMORY) return Promise.resolve(MEMORY[company])
  if (!PENDING[company]) {
    PENDING[company] = resolve(company).then(domain => {
      MEMORY[company] = domain
      if (domain) {
        const next = loadStore()
        next[company] = domain
        try { localStorage.setItem(STORE_KEY, JSON.stringify(next)) } catch { /* private mode */ }
      }
      return domain
    }).catch(() => {
      MEMORY[company] = null
      return null
    })
  }
  return PENDING[company]
}

const SUFFIX = /\s+(group|global|holdings?|corporation|corp|inc|incorporated|llc|ltd|limited|company|co|technolog(y|ies)|systems?|solutions?|services?|international|intl)\.?$/gi

// Query variants, most specific first, so a noisy feed name still resolves.
function variants(company: string): string[] {
  const out = [company]
  let stripped = company
  while (SUFFIX.test(stripped)) stripped = stripped.replace(SUFFIX, '').trim()
  if (stripped && stripped !== company) out.push(stripped)
  const first = stripped.split(/\s+/)[0]
  if (first && first.length >= 3 && !out.includes(first)) out.push(first)
  return out
}

async function suggest(query: string): Promise<{ name?: string; domain?: string }[]> {
  const url = `https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(query)}`
  try {
    const res = await fetch(url)
    if (!res.ok) return []
    const list = await res.json()
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

async function resolve(company: string): Promise<string | null> {
  const [original, ...derived] = variants(company)
  for (const [i, query] of [original, ...derived].entries()) {
    const list = await suggest(query)
    if (list.length === 0) continue
    const q = norm(query)
    const exact = list.find(c => c.name && norm(c.name) === q)
    if (exact?.domain) return exact.domain
    // Only trust a non-exact first hit for the name as written, never for a
    // truncated variant (that's how "Atkins" grabs the wrong Atkins).
    if (i === 0 && list[0]?.domain) return list[0].domain
  }
  return null
}