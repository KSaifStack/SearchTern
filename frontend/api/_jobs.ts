// The job index, shared by the CDN-cached search endpoint (/api/index) and the
// SEO job pages (/api/og). One upstream read, trimmed to the fields search and
// page meta actually use.
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
    const res = await fetch(`${API}/recent`)
    if (!res.ok) throw new Error(`/recent returned HTTP ${res.status}`)
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
