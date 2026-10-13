// Resolves a company name to its real domain via Clearbit autocomplete, so
// favicons don't guess "x.com" (TIAA -> tiaa.org, not tiaa.com).
// ponytail: third-party autocomplete per unique company; memoized in memory
// and localStorage so each browser hits it once per company per session.
const MEMORY: Record<string, string | null> = {}
const PENDING: Record<string, Promise<string | null>> = {}
const STORE_KEY = 'searchtern-company-domains'

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
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

async function resolve(company: string): Promise<string | null> {
  const url = `https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(company)}`
  const res = await fetch(url)
  if (!res.ok) return null
  const list: { name?: string; domain?: string }[] = await res.json()
  if (!Array.isArray(list) || list.length === 0) return null
  const q = norm(company)
  const exact = list.find(c => c.name && norm(c.name) === q)
  const pick = exact || list[0]
  return pick?.domain || null
}