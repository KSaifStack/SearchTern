export interface ParsedLocation {
  countries: string[]
  states: string[]
}

const COUNTRIES = new Set(['United States', 'United States of America', 'USA', 'US', 'United Kingdom', 'UK', 'Canada'])

function stateCode(tok: string): string | null {
  return US_STATES[tok] ? tok : (NAME_TO_CODE.get(tok) ?? null)
}

// Comma-joined multi-city list ("Phoenix, AZ, Tempe, AZ, ..."): a location
// ends at a state or country token — unless a country follows the state
// ("Denver, Colorado, United States") or the next token is that same state
// ("New York, NY", where the city matches the state *name*). Unknown tokens
// just stay grouped.
export function splitCommaLocations(location: string): string[] {
  const tokens = location.split(',').map(t => t.trim()).filter(Boolean)
  const groups: string[] = []
  let cur: string[] = []
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]
    const next = tokens[i + 1] ?? ''
    cur.push(tok)
    const code = stateCode(tok)
    const continues =
      COUNTRIES.has(next) ||
      (code !== null && code === stateCode(next))
    if (COUNTRIES.has(tok) || !next || (code !== null && !continues)) {
      groups.push(cur.join(', '))
      cur = []
    }
  }
  if (cur.length) groups.push(cur.join(', '))
  return groups
}

// Listings pack every city into one field. Keep long location lists compact.
export function trimLocations(location: string): string {
  let parts = location.split(/[;|]/).map(s => s.trim()).filter(Boolean)
  if (parts.length <= 3) parts = splitCommaLocations(location)
  if (parts.length <= 3) return location
  return parts.slice(0, 3).join('; ') + '...'
}

export const US_STATES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  DC: 'District of Columbia',
}

const NAME_TO_CODE = new Map(Object.entries(US_STATES).map(([name, code]) => [name, code]))

const STATE_NAME_TO_ABBR: Record<string, string> = Object.fromEntries(
  Object.entries(US_STATES).map(([abbr, name]) => [name.toLowerCase(), abbr])
)

const CITY_TO_STATE: Record<string, string> = {
  nyc: 'NY', 'new york': 'NY', sf: 'CA', 'san francisco': 'CA', la: 'CA', 'los angeles': 'CA',
  philly: 'PA', 'washington dc': 'DC', 'washington d.c.': 'DC', 'st louis': 'MO',
  'new orleans': 'LA', 'silicon valley': 'CA',
}

const COUNTRY_KEYWORDS: Array<[string, string[]]> = [
  ['Remote', ['remote']],
  ['United States', ['united states', 'usa', 'u.s.a.', 'us', 'america', 'states']],
  ['United Kingdom', ['united kingdom', 'uk', 'england', 'scotland', 'wales', 'britain', 'london', 'edinburgh', 'manchester', 'birmingham']],
  ['Canada', ['canada', 'toronto', 'vancouver', 'montreal', 'ottawa', 'calgary', 'ontario', 'quebec']],
  ['Germany', ['germany', 'berlin', 'munich', 'hamburg', 'stuttgart']],
  ['India', ['india', 'bangalore', 'bengaluru', 'hyderabad', 'mumbai', 'pune', 'chennai', 'gurgaon']],
  ['Singapore', ['singapore']],
  ['France', ['france', 'paris']],
  ['Netherlands', ['netherlands', 'amsterdam']],
  ['Switzerland', ['switzerland', 'zurich', 'geneva']],
  ['Ireland', ['ireland', 'dublin']],
  ['Australia', ['australia', 'sydney', 'melbourne', 'canberra', 'perth']],
  ['Japan', ['japan', 'tokyo', 'osaka']],
  ['Mexico', ['mexico', 'mexico city']],
  ['China', ['china', 'hong kong', 'shanghai', 'beijing', 'shenzhen']],
  ['UAE', ['uae', 'dubai', 'abu dhabi']],
  ['Brazil', ['brazil', 'sao paulo', 'são paulo']],
  ['Spain', ['spain', 'madrid', 'barcelona']],
  ['Italy', ['italy', 'milan', 'rome']],
  ['Poland', ['poland', 'warsaw', 'krakow']],
  ['Sweden', ['sweden', 'stockholm']],
  ['South Korea', ['south korea', 'seoul']],
  ['Israel', ['israel', 'tel aviv']],
]

const word = (s: string) => `\\b${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`

function detectCountries(lower: string): string[] {
  const found: string[] = []
  for (const [country, keywords] of COUNTRY_KEYWORDS) {
    for (const kw of keywords) {
      if (new RegExp(word(kw), 'i').test(lower)) {
        found.push(country)
        break
      }
    }
  }
  return found
}

export function parseLocation(location: string): ParsedLocation {
  const raw = location || ''
  const lower = raw.toLowerCase()

  const countries = detectCountries(lower)
  const states = new Set<string>()

  const tokens = lower.split(/[;,\n/-]/).map(t => t.trim()).filter(Boolean)
  for (const token of tokens) {
    if (token.length === 2 && US_STATES[token.toUpperCase()]) {
      states.add(token.toUpperCase())
      continue
    }
    if (STATE_NAME_TO_ABBR[token]) {
      states.add(STATE_NAME_TO_ABBR[token])
      continue
    }
    if (CITY_TO_STATE[token]) {
      states.add(CITY_TO_STATE[token])
    }
  }

  if (states.size > 0 && !countries.includes('United States')) {
    countries.push('United States')
  }
  if (countries.length === 0 && lower.trim() !== '') {
    countries.push('United States')
  }

  return { countries, states: [...states] }
}
