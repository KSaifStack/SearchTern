import { useState, useEffect } from 'react'
import { getCompanyDomain, awaitCompanyDomain } from '../utils/companyDomain'

const PROVIDERS = (domain: string) => [
  `https://icons.duckduckgo.com/ip3/${domain}.ico`,
  `https://icons.duckduckgo.com/ip3/www.${domain}.ico`,
  `https://www.google.com/s2/favicons?domain=${domain}&sz=32`,
]

// icon.horse resolves redirects on its own (tiaa.com -> tiaa.org in ~50ms), so
// the naive .com guess renders the right icon without waiting on Clearbit.
const GUESS_PROVIDERS = (domain: string) => [
  `https://icon.horse/icon/${domain}`,
  `https://www.google.com/s2/favicons?domain=${domain}&sz=32`,
]

function guessDomain(company: string): string {
  return `${company.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}.com`
}

// Renders the naive x.com guess instantly (old behavior), then swaps to the
// resolved domain once Clearbit answers — no blank-while-loading delay.
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
  const srcs = resolved
    ? PROVIDERS(domain)
    : GUESS_PROVIDERS(guess)
  if (srcIndex >= srcs.length) return null

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