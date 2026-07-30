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

export async function getRecent() {
    if (cached) return { success: true, data: cached } as const
    const result = await pullRecent()
    if (!result) return { success: false, data: [] } as const
    cached = result
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
    cached = result
    return { success: true, data: result } as const
}

export function clearCache() {
    cached = null
}

export function getSecondsUntilNextHour(): number {
    const now = new Date()
    return 3600 - (now.getMinutes() * 60 + now.getSeconds())
}





