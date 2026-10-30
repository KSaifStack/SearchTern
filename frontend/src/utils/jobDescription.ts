// Heuristic structuring of scraped job descriptions into quick-glance sections.
// This is NOT summarization — it reorganizes existing text under detected
// section headers (and a money-pattern fallback for compensation). Most
// legacy rows were scraped before the backend preserved line breaks, so
// everything arrives as one run-on paragraph; splitting on header phrases
// still works regardless of whitespace, which is why that's the signal used
// here instead of relying on bullets/newlines.

type Category = 'responsibilities' | 'qualifications' | 'compensation'

interface HeaderPattern {
  category: Category
  regex: RegExp
}

const HEADER_PATTERNS: HeaderPattern[] = [
  {
    category: 'responsibilities',
    regex: /\b(key responsibilities|responsibilities|what you(?:'|’)ll do|what you will do|duties and responsibilities|day-to-day responsibilities)\s*:?/gi,
  },
  {
    category: 'qualifications',
    regex: /\b(required qualifications|preferred qualifications|minimum qualifications|basic qualifications|qualifications|requirements|required skills|what we(?:'|’)re looking for|who you are)\s*:?/gi,
  },
  {
    category: 'compensation',
    regex: /\b(compensation|salary range|pay range|base salary|base pay|hourly rate|salary)\s*:?/gi,
  },
]

const MONEY_RE = /\$\s?\d[\d,]*(?:\.\d+)?\s?k?(?:\s?-\s?\$?\s?\d[\d,]*(?:\.\d+)?\s?k?)?(?:\s?\/?\s?(?:yr|year|hr|hour|annually))?/gi

export interface DescriptionSection {
  label: string
  items: string[]
}

function clampItem(raw: string, max = 220): string {
  let s = raw.replace(/\s+/g, ' ').trim()
  // A trailing dash with nothing after it is a leftover bullet marker from a
  // list that ran off the end of the source text, not real content.
  s = s.replace(/\s*-+\s*$/, '')
  // A header match can land mid-sentence, leaving the kept half starting
  // lowercase (e.g. "...hourly rate" cuts to "is determined..."); capitalize
  // so it still reads as a clean bullet.
  if (s) s = s[0].toUpperCase() + s.slice(1)
  if (s.length <= max) return s
  return s.slice(0, max).replace(/\s+\S*$/, '') + '…'
}

function extractItems(segment: string, max: number): string[] {
  // Some sources already flatten their own bullets to inline "- " markers
  // with no real line break (e.g. "...documentation. - Support monthly..."),
  // which would otherwise block sentence-splitting below since it needs an
  // uppercase letter right after the period, not a hyphen. Turn those back
  // into line breaks so the bullet path below can catch them.
  const trimmed = segment.trim().replace(/(^|[.!?]\s+)-\s+/g, (_m, pre: string) => `${pre}\n- `)
  if (!trimmed) return []

  // Real bullet lines survive only on rows scraped after the backend fix —
  // prefer them when present since they're already well-formed.
  const bulletLines = trimmed
    .split('\n')
    .map(l => l.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean)
  if (bulletLines.length > 1) {
    return bulletLines.slice(0, max).map(l => clampItem(l))
  }

  // Legacy run-on text: fall back to sentence boundaries. A header match can
  // land mid-sentence (e.g. "hourly rate" inside a sentence already under
  // way), leaving a dangling, unpunctuated fragment at the segment's edge —
  // drop those rather than show a bullet that trails off mid-thought.
  const sentences = trimmed
    .replace(/\n+/g, ' ')
    .split(/(?<=[.?!])\s+(?=[A-Z0-9])/)
    .map(s => s.trim())
    .filter(s => s.length >= 12 && /[.?!]$/.test(s))

  return sentences.slice(0, max).map(s => clampItem(s))
}

function dedupe(items: string[]): string[] {
  return Array.from(new Set(items))
}

export function parseJobDescription(raw: string | null | undefined): DescriptionSection[] {
  if (!raw) return []
  const text = raw.replace(/\r\n/g, '\n')

  const matches: { index: number; end: number; category: Category }[] = []
  for (const { category, regex } of HEADER_PATTERNS) {
    regex.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = regex.exec(text))) {
      matches.push({ index: m.index, end: m.index + m[0].length, category })
    }
  }
  matches.sort((a, b) => a.index - b.index)

  const buckets: Record<'intro' | Category, string[]> = {
    intro: [],
    responsibilities: [],
    qualifications: [],
    compensation: [],
  }

  if (matches.length === 0) {
    buckets.intro = extractItems(text, 4)
  } else {
    const intro = text.slice(0, matches[0].index)
    if (intro.trim()) buckets.intro = extractItems(intro, 3)
    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].end
      const end = i + 1 < matches.length ? matches[i + 1].index : text.length
      buckets[matches[i].category].push(...extractItems(text.slice(start, end), 4))
    }
  }

  if (buckets.compensation.length === 0) {
    const found = dedupe(Array.from(text.matchAll(MONEY_RE)).map(m => m[0].trim()).filter(Boolean))
    if (found.length) buckets.compensation = found.slice(0, 2)
  }

  // A compensation section exists to surface a number — when several
  // candidate sentences were found, keep the ones that actually contain a
  // figure ahead of generic filler like "This is a paid internship."
  const compensation = dedupe(buckets.compensation)
  const withNumbers = compensation.filter(s => /\d/.test(s))
  const rankedCompensation = (withNumbers.length ? withNumbers : compensation).slice(0, 2)

  const sections: DescriptionSection[] = []
  if (buckets.intro.length) sections.push({ label: 'Overview', items: buckets.intro })
  if (buckets.responsibilities.length) sections.push({ label: "What you'll do", items: dedupe(buckets.responsibilities).slice(0, 4) })
  if (buckets.qualifications.length) sections.push({ label: 'Qualifications', items: dedupe(buckets.qualifications).slice(0, 4) })
  if (rankedCompensation.length) sections.push({ label: 'Compensation', items: rankedCompensation })
  return sections
}
