export interface CompanyMeta {
  employees: number
  faang: boolean
}

// Curated big-tech employee counts (approx, as of 2026) + FAANG flag.
// Company names in listings are noisy ("Amazon Com Services Llc"), so
// matching normalizes to lowercase alphanumerics and falls back to a
// substring check. Unknown companies return null -> excluded by filters.
// ponytail: static snapshot, refresh when employees/labels matter enough.
const METAS: Record<string, CompanyMeta> = {
  'google': { employees: 183000, faang: true },
  'meta': { employees: 74000, faang: true },
  'apple': { employees: 164000, faang: true },
  'amazon': { employees: 1560000, faang: true },
  'netflix': { employees: 14000, faang: true },
  'microsoft': { employees: 228000, faang: false },
  'nvidia': { employees: 31000, faang: false },
  'tesla': { employees: 140000, faang: false },
  'alphabet': { employees: 183000, faang: true },
  'facebook': { employees: 74000, faang: true },
  'openai': { employees: 2500, faang: false },
  'anthropic': { employees: 2000, faang: false },
  'apple inc': { employees: 164000, faang: true },
  'amazon web services': { employees: 1560000, faang: true },
  'google llc': { employees: 183000, faang: true },
  'google inc': { employees: 183000, faang: true },
  'metaverse': { employees: 74000, faang: true },
  'nvidia corporation': { employees: 31000, faang: false },
  'intel': { employees: 125000, faang: false },
  'intel corporation': { employees: 125000, faang: false },
  'amd': { employees: 26000, faang: false },
  'advanced micro devices': { employees: 26000, faang: false },
  'qualcomm': { employees: 50000, faang: false },
  'oracle': { employees: 159000, faang: false },
  'oracle cloud': { employees: 159000, faang: false },
  'ibm': { employees: 282000, faang: false },
  'salesforce': { employees: 72000, faang: false },
  'salesforce inc': { employees: 72000, faang: false },
  'adobe': { employees: 30000, faang: false },
  'adobe inc': { employees: 30000, faang: false },
  'cisco': { employees: 85000, faang: false },
  'cisco systems': { employees: 85000, faang: false },
  'servicenow': { employees: 25000, faang: false },
  'workday': { employees: 20000, faang: false },
  'workday inc': { employees: 20000, faang: false },
  'datadog': { employees: 6000, faang: false },
  'snowflake': { employees: 8000, faang: false },
  'palantir': { employees: 4000, faang: false },
  'palantir technologies': { employees: 4000, faang: false },
  'crowdstrike': { employees: 8000, faang: false },
  'stripe': { employees: 8000, faang: false },
  'stripe inc': { employees: 8000, faang: false },
  'coinbase': { employees: 4000, faang: false },
  'square': { employees: 13000, faang: false },
  'block': { employees: 13000, faang: false },
  'robinhood': { employees: 4000, faang: false },
  'robinhood markets': { employees: 4000, faang: false },
  'paypal': { employees: 30000, faang: false },
  'paypal holdings': { employees: 30000, faang: false },
  'airbnb': { employees: 7000, faang: false },
  'airbnb inc': { employees: 7000, faang: false },
  'uber': { employees: 33000, faang: false },
  'ubet': { employees: 33000, faang: false },
  'doordash': { employees: 10000, faang: false },
  'lyft': { employees: 5000, faang: false },
  'instacart': { employees: 6000, faang: false },
  'shopify': { employees: 9000, faang: false },
  'shopify inc': { employees: 9000, faang: false },
  'spotify': { employees: 9000, faang: false },
  'spotify usa': { employees: 9000, faang: false },
  'twitter': { employees: 1500, faang: false },
  'x corp': { employees: 1500, faang: false },
  'linkedin': { employees: 20000, faang: false },
  'linkedin corporation': { employees: 20000, faang: false },
  'snap': { employees: 5000, faang: false },
  'snap inc': { employees: 5000, faang: false },
  'pinterest': { employees: 4000, faang: false },
  'pinterest inc': { employees: 4000, faang: false },
  'reddit': { employees: 2000, faang: false },
  'reddit inc': { employees: 2000, faang: false },
  'discord': { employees: 1000, faang: false },
  'roblox': { employees: 2500, faang: false },
  'roblox corporation': { employees: 2500, faang: false },
  'epic games': { employees: 3000, faang: false },
  'epicgames': { employees: 3000, faang: false },
  'twitch': { employees: 1500, faang: false },
  'twilio': { employees: 5000, faang: false },
  'cloudflare': { employees: 4000, faang: false },
  'cloudflare inc': { employees: 4000, faang: false },
  'vercel': { employees: 500, faang: false },
  'vercel inc': { employees: 500, faang: false },
  'databricks': { employees: 7000, faang: false },
  'databricks inc': { employees: 7000, faang: false },
  'confluent': { employees: 3000, faang: false },
  'confluent inc': { employees: 3000, faang: false },
  'mongodb': { employees: 5000, faang: false },
  'mongodb inc': { employees: 5000, faang: false },
  'elastic': { employees: 2000, faang: false },
  'elasticsearch': { employees: 2000, faang: false },
  'figma': { employees: 1000, faang: false },
  'notion': { employees: 500, faang: false },
  'notion labs': { employees: 500, faang: false },
  'asana': { employees: 1800, faang: false },
  'asana inc': { employees: 1800, faang: false },
  'atlassian': { employees: 11000, faang: false },
  'atlassian corp': { employees: 11000, faang: false },
  'slack': { employees: 2500, faang: false },
  'slack technologies': { employees: 2500, faang: false },
  'zoom': { employees: 7000, faang: false },
  'zoom video communications': { employees: 7000, faang: false },
  'dropbox': { employees: 3000, faang: false },
  'dropbox inc': { employees: 3000, faang: false },
  'box': { employees: 2500, faang: false },
  'box inc': { employees: 2500, faang: false },
  'okta': { employees: 5000, faang: false },
  'okta inc': { employees: 5000, faang: false },
  'zscaler': { employees: 8000, faang: false },
  'zscaler inc': { employees: 8000, faang: false },
  'palo alto networks': { employees: 15000, faang: false },
  'fortinet': { employees: 13000, faang: false },
  'fortinet inc': { employees: 13000, faang: false },
  'vmware': { employees: 38000, faang: false },
  'dell': { employees: 120000, faang: false },
  'dell technologies': { employees: 120000, faang: false },
  'hewlett packard': { employees: 58000, faang: false },
  'hp': { employees: 58000, faang: false },
  'hp inc': { employees: 58000, faang: false },
  'hp enterprise': { employees: 60000, faang: false },
  'hpe': { employees: 60000, faang: false },
  'lenovo': { employees: 77000, faang: false },
  'lenovo group': { employees: 77000, faang: false },
  'samsung': { employees: 270000, faang: false },
  'samsung electronics': { employees: 270000, faang: false },
  'lg': { employees: 74000, faang: false },
  'lg electronics': { employees: 74000, faang: false },
  'sony': { employees: 113000, faang: false },
  'sony corporation': { employees: 113000, faang: false },
  'sony interactive entertainment': { employees: 12000, faang: false },
  'tiktok': { employees: 150000, faang: false },
  'bytedance': { employees: 150000, faang: false },
  'tiktok pte': { employees: 150000, faang: false },
  'nokia': { employees: 86000, faang: false },
  'ericsson': { employees: 100000, faang: false },
  'ericsson inc': { employees: 100000, faang: false },
  'telefonica': { employees: 100000, faang: false },
  'verizon': { employees: 105000, faang: false },
  'verizon communications': { employees: 105000, faang: false },
  'at&t': { employees: 150000, faang: false },
  'att': { employees: 150000, faang: false },
  't mobile': { employees: 170000, faang: false },
  'tmobile': { employees: 170000, faang: false },
  'comcast': { employees: 170000, faang: false },
  'comcast corporation': { employees: 170000, faang: false },
  'charter communications': { employees: 100000, faang: false },
  'spectrum': { employees: 100000, faang: false },
  'cox': { employees: 80000, faang: false },
  'cox enterprises': { employees: 80000, faang: false },
  'nxp': { employees: 34000, faang: false },
  'nxp semiconductors': { employees: 34000, faang: false },
  'texas instruments': { employees: 34000, faang: false },
  'ti': { employees: 34000, faang: false },
  'micron': { employees: 48000, faang: false },
  'micron technology': { employees: 48000, faang: false },
  'marvell': { employees: 7000, faang: false },
  'marvell technology': { employees: 7000, faang: false },
  'broadcom': { employees: 20000, faang: false },
  'broadcom inc': { employees: 20000, faang: false },
  'kla': { employees: 14000, faang: false },
  'kla corporation': { employees: 14000, faang: false },
  'applied materials': { employees: 34000, faang: false },
  'lam research': { employees: 12000, faang: false },
  'arm': { employees: 7000, faang: false },
  'arm holdings': { employees: 7000, faang: false },
  'globalfoundries': { employees: 13000, faang: false },
  'tsmc': { employees: 85000, faang: false },
  'sk hynix': { employees: 31000, faang: false },
  'samsung semiconductors': { employees: 270000, faang: false },
  'infineon': { employees: 58000, faang: false },
  'analog devices': { employees: 26000, faang: false },
  'microchip': { employees: 22000, faang: false },
  'microchip technology': { employees: 22000, faang: false },
  'western digital': { employees: 51000, faang: false },
  'sandisk': { employees: 9000, faang: false },
  'seagate': { employees: 35000, faang: false },
  'seagate technology': { employees: 35000, faang: false },
  'hp mixed reality': { employees: 58000, faang: false },
  'cerebras': { employees: 500, faang: false },
  'cerebras systems': { employees: 500, faang: false },
  'amd inc': { employees: 26000, faang: false },
  'walmart': { employees: 2100000, faang: false },
  'amazon com services': { employees: 1560000, faang: true },
  'amazon development': { employees: 1560000, faang: true },
  'amazon kuiper': { employees: 1560000, faang: true },
  'amazon web services aws': { employees: 1560000, faang: true },
  'meta platforms': { employees: 74000, faang: true },
}

function normalize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export interface CompanyMatch extends CompanyMeta {
  canonical: string
}

export function matchCompanyMeta(name: string): CompanyMatch | null {
  if (!name) return null
  const key = normalize(name)
  if (METAS[key]) return { ...METAS[key], canonical: findCanonical(key) }
  // Noisy ATS names: fall back to substring match on both directions.
  for (const [k, meta] of Object.entries(METAS)) {
    if (k.length >= 4 && (key.includes(k) || k.includes(key))) {
      return { ...meta, canonical: k }
    }
  }
  return null
}

function findCanonical(key: string): string {
  return key
}

export const EMPLOYEE_BUCKETS = [
  { label: '1–500', min: 0, max: 500 },
  { label: '501–5,000', min: 501, max: 5000 },
  { label: '5,001–50,000', min: 5001, max: 50000 },
  { label: '50,001–200,000', min: 50001, max: 200000 },
  { label: '200,001+', min: 200001, max: Infinity },
] as const

export function inEmployeeBucket(employees: number, bucket: (typeof EMPLOYEE_BUCKETS)[number]): boolean {
  return employees >= bucket.min && employees <= bucket.max
}

export const FAANG_COMPANIES = new Set(
  Object.entries(METAS)
    .filter(([, m]) => m.faang)
    .map(([k]) => k)
)