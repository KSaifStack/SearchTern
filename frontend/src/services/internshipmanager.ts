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

let cached: Job[] | null = null
let cachedAt = 0

function isCurrentHour(ts: number): boolean {
    const hourStart = new Date()
    hourStart.setMinutes(0, 0, 0)
    return ts >= hourStart.getTime()
}

export async function getRecent() {
    if (cached && isCurrentHour(cachedAt)) {
        return { success: true, data: cached } as const
    }
    const result = await pullRecent()
    if (result && result.length > 0) {
        cached = result
        cachedAt = Date.now()
    }
    return { success: Boolean(result), data: result || [] } as const
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
    cached = result
    cachedAt = Date.now()
    return { success: true, data: result } as const
}

export function clearCache() {
    cached = null
    cachedAt = 0
}

export function getSecondsUntilNextHour(): number {
    const now = new Date()
    return 3600 - (now.getMinutes() * 60 + now.getSeconds())
}
