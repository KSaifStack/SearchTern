// This will handles job data from api
import { pullUpdateBackend, pullRecent, pullLocation, pullKeyword } from "../api/internships.ts"; 

interface Job{
    id: number,
    company: string,
    role: string,
    location: string,
    date: string,
    link: string,
    type?: string,
    season?: string
}

let cache: { data: Job[]; time: number } | null = null
const CACHE_TTL = 3600_000 // 1 hour

export async function getRecent() {
    const now = Date.now()
    if (cache && now - cache.time < CACHE_TTL) {
        return { success: true, data: cache.data } as const
    }
    const result = await pullRecent()
    if (!result) return { success: false, data: [] } as const
    cache = { data: result, time: now }
    return { success: true, data: result } as const
}

export async function searchByLocation(searchterm: string){
    const result = await pullLocation(searchterm);
    if(!result) return { success: false, data: [] } as const
    return { success: true, data: result } as const
}

export async function searchByKeyword(searchterm: string){
    const result = await pullKeyword(searchterm);
    if(!result) return { success: false, data: [] } as const
    return { success: true, data: result } as const
}

export async function getDatabase() {
    const result = await pullUpdateBackend()
    if (!result) return { success: false, data: [] } as const
    cache = { data: result, time: Date.now() }
    return { success: true, data: result } as const
}

export function clearCache() {
    cache = null
}

export function getCacheRemaining(): number {
    if (!cache) return 0
    const elapsed = Date.now() - cache.time
    return Math.max(0, Math.round((CACHE_TTL - elapsed) / 1000))
}

export { CACHE_TTL }





