// Rough US pay bands by role category, used only when a listing has no pay
// data of its own (the feed carries none today). These are deliberately wide
// ballpark ranges, always rendered as "Est." with an explanation, never as the
// listing's real salary.
// ponytail: static snapshot (~2026 US market); revisit if real pay data lands in the feed.

type Band = [low: number, high: number]

// Internships: USD per hour.
const INTERN_HOURLY: Record<string, Band> = {
  'Software Engineering': [28, 45],
  'Data/ML/AI': [30, 48],
  'DevOps/SRE': [28, 42],
  'Cybersecurity': [25, 38],
  'Hardware/Embedded': [25, 38],
  'Finance/Quant': [30, 55],
  'Product/Design': [25, 40],
  'Research/Science': [22, 35],
  'Business/Analytics': [22, 32],
  'Accounting': [22, 30],
  'Sales/Business Dev': [18, 26],
  'Marketing/Comms': [18, 26],
  'Operations/Supply': [20, 28],
  'Legal/Compliance': [20, 30],
  'Human Resources': [18, 25],
  'Healthcare/Clinical': [17, 25],
  'Construction/Trades': [18, 26],
  'Customer/Retail': [15, 20],
  'Education': [15, 22],
  'Government/Public Service': [16, 24],
}

// New grad: USD thousands per year (base).
const NEWGRAD_ANNUAL_K: Record<string, Band> = {
  'Software Engineering': [95, 135],
  'Data/ML/AI': [100, 140],
  'DevOps/SRE': [90, 125],
  'Cybersecurity': [85, 115],
  'Hardware/Embedded': [85, 115],
  'Finance/Quant': [90, 150],
  'Product/Design': [80, 115],
  'Research/Science': [70, 100],
  'Business/Analytics': [70, 90],
  'Accounting': [60, 75],
  'Sales/Business Dev': [55, 75],
  'Marketing/Comms': [50, 65],
  'Operations/Supply': [55, 72],
  'Legal/Compliance': [55, 75],
  'Human Resources': [50, 65],
  'Healthcare/Clinical': [55, 75],
  'Construction/Trades': [55, 75],
  'Customer/Retail': [38, 50],
  'Education': [42, 55],
  'Government/Public Service': [45, 60],
}

// Large tech companies pay well above the category median for technical roles.
const TOP_TIER_CATEGORIES = new Set([
  'Software Engineering', 'Data/ML/AI', 'DevOps/SRE', 'Cybersecurity',
  'Hardware/Embedded', 'Product/Design', 'Research/Science',
])
const TOP_TIER_MULTIPLIER = 1.35

export interface SalaryEstimate {
  label: string
  explanation: string
}

export function estimateSalary(opts: {
  category?: string | null
  type?: string
  topTier: boolean
  inUS: boolean
}): SalaryEstimate | null {
  const { category, type, topTier, inUS } = opts
  // Bands are US-only, and "Other"/missing categories are too broad to price.
  if (!inUS || !category) return null
  const newGrad = type === 'newgrad'
  const band = (newGrad ? NEWGRAD_ANNUAL_K : INTERN_HOURLY)[category]
  if (!band) return null

  const boost = topTier && TOP_TIER_CATEGORIES.has(category)
  const scale = boost ? TOP_TIER_MULTIPLIER : 1
  const low = Math.round(band[0] * scale)
  const high = Math.round(band[1] * scale)
  const label = newGrad ? `Est. $${low}K–$${high}K/yr` : `Est. $${low}–$${high}/hr`
  const explanation =
    `Rough estimate for US ${category} ${newGrad ? 'new grad' : 'internship'} roles` +
    `${boost ? ' at large tech companies' : ''}. Not taken from this listing — check the posting for actual pay.`
  return { label, explanation }
}
