// Generates public/sitemap.xml at build time: static routes + every live job id.
// If the API is unreachable, falls back to static routes only.
import { writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const SITE = "https://searchtern.ksaif.dev"
const API = process.env.SITEMAP_API_URL || "https://api.searchtern.ksaif.dev"

const staticRoutes = [
    { path: "/", priority: "1.0" },
    { path: "/jobs", priority: "0.9" },
    { path: "/privacy", priority: "0.3" },
]

let jobUrls = []
try {
    const res = await fetch(`${API}/recent`)
    if (res.ok) {
        const data = await res.json()
        const jobs = Array.isArray(data?.result) ? data.result : []
        jobUrls = jobs.map(j => ({ path: `/jobs/${j.id}`, priority: "0.6" }))
        console.log(`sitemap: fetched ${jobUrls.length} job URLs`)
    } else {
        console.warn(`sitemap: /recent returned HTTP ${res.status}, static routes only`)
    }
} catch (e) {
    console.warn(`sitemap: could not fetch jobs (${e.message}), static routes only`)
}

const urlLines = [...staticRoutes, ...jobUrls]
    .map(u => `  <url><loc>${SITE}${u.path}</loc><priority>${u.priority}</priority></url>`)

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlLines.join("\n")}
</urlset>
`

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "sitemap.xml")
writeFileSync(out, xml)
console.log(`sitemap.xml written with ${urlLines.length} URLs`)