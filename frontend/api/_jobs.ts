// The job index, shared by the CDN-cached search endpoint (/api/index) and the
// SEO job pages (/api/og). Served as a static R2 object when INDEX_R2_URL is
// set (zero egress), with the API as fallback. Trimmed to the fields search
// and page meta actually use.
const R2 = process.env.INDEX_R2_URL || "";
const API = process.env.INDEX_API_URL || "https://api.searchtern.ksaif.dev";

export interface IndexJob {
    id: number
    company: string
    role: string
    location: string
    date: number | string
    link: string
    type?: string
    season?: string
}

export async function fetchIndex(): Promise<IndexJob[]> {
    const src = R2 ? `${R2}/jobs.json` : `${API}/recent`;
    const res = await fetch(src)
    if (!res.ok) throw new Error(`${src} returned HTTP ${res.status}`)
    const data = await res.json()
    const rows: Record<string, unknown>[] = Array.isArray(data?.result) ? data.result : []
    return rows.map(r => ({
        id: r.id as number,
        company: r.company as string,
        role: r.role as string,
        location: r.location as string,
        date: r.date as number | string,
        link: r.link as string,
        type: r.type as string | undefined,
        season: r.season as string | undefined,
    }))
}

export async function findJob(id: string): Promise<IndexJob | null> {
    const jobs = await fetchIndex()
    return jobs.find(j => String(j.id) === id) ?? null
}
