import { useState, useEffect } from 'react'
import { getCompanyDomain, awaitCompanyDomain } from '../utils/companyDomain'

// Real-domain chain: DDG resolves most, Google catches the rest. A miss on a
// guessed domain 404s (unlike icon.horse, which answers dead domains with a
// 200 placeholder globe), so onError advances the chain as intended.
const PROVIDERS = (domain: string) => [
  `https://icons.duckduckgo.com/ip3/${domain}.ico`,
  `https://icons.duckduckgo.com/ip3/www.${domain}.ico`,
  `https://www.google.com/s2/favicons?domain=${domain}&sz=32`,
]

function guessDomain(company: string): string {
  return `${company.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}.com`
}

function initial(company: string): string {
  return (company.match(/[a-zA-Z0-9]/)?.[0] || '?').toUpperCase()
}

// Stable pastel from the name so a company always gets the same colour.
function avatarColor(company: string): string {
  let h = 0
  for (let i = 0; i < company.length; i++) h = (h * 31 + company.charCodeAt(i)) | 0
  return `hsl(${Math.abs(h) % 360} 45% 45%)`
}

// Renders the naive x.com guess instantly, swaps to the resolved domain once
// Clearbit answers, and falls back to an initials monogram (never a blank or a
// wrong placeholder globe) when nothing resolves.
export function CompanyFavicon({ company, size = 16 }: { company: string; size?: number }) {
  const guess = guessDomain(company)
  const [domain, setDomain] = useState<string>(() => getCompanyDomain(company) || guess)
  const [srcIndex, setSrcIndex] = useState(0)

  useEffect(() => {
    let cancelled = false
    awaitCompanyDomain(company).then(d => {
      if (!cancelled && d && d !== guess) setDomain(d)
    })
    return () => { cancelled = true }
  }, [company, guess])

  const resolved = domain !== guess
  const srcs = resolved ? PROVIDERS(domain) : [`https://www.google.com/s2/favicons?domain=${guess}&sz=32`]

  if (srcIndex >= srcs.length) {
    return (
      <span
        aria-hidden="true"
        style={{
          width: size, height: size, borderRadius: '2px',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          background: avatarColor(company), color: '#fff',
          fontSize: Math.max(8, Math.round(size * 0.55)), fontWeight: 600, lineHeight: 1,
        }}
      >
        {initial(company)}
      </span>
    )
  }

  return (
    <img
      key={domain}
      src={srcs[srcIndex]}
      style={{ width: size, height: size, borderRadius: '2px' }}
      alt=""
      onError={() => setSrcIndex(i => i + 1)}
    />
  )
}
