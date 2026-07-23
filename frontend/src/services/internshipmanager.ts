// This will handles job data from api
import { pullUpdateBackend,pullRecent,pullLocation,pullKeyword } from "../api/internships.ts"; 

interface Job{
    id: number,
    company: string,
    role: string,
    location: string,
    date: string,
    link: string   
}

const jobCache: Record<string, Job[]> = {}
let lastRefreshed: Date | null = null;
let recentCache: Job[] = []

function getCacheKey(searchterm: string): string {
    const hour = new Date().getHours()
    return `${searchterm}-${hour}`
}

export async function searchByLocation(searchterm: string){
    const key = getCacheKey(searchterm);
    if(jobCache[key]){
        console.log("Loaded from cache.");
        return {success: true,data: jobCache[key],lastRefreshed: null}
    }
    const result = await pullLocation(searchterm);
    if(!result){
        return { success: false, data: [], lastRefreshed: null }
    }
    jobCache[key] = result
    lastRefreshed = new Date()
    return { success: true, data: result, lastRefreshed }
    
}

export async function searchByKeyword(searchterm: string){
    const key = getCacheKey(searchterm);
    if(jobCache[key]){
        console.log("Loaded from cache.");
        return {success: true,data: jobCache[key],lastRefreshed: null}
    }
    const result = await pullKeyword(searchterm);
    if(!result){
        return { success: false, data: [], lastRefreshed: null }
    }
    jobCache[key] = result
    lastRefreshed = new Date()
    return { success: true, data: result, lastRefreshed }
    
}

export async function getRecent() {
    const currentHour = new Date().getHours()
    const lastHour = lastRefreshed?.getHours()

    if (recentCache.length > 0 && lastHour === currentHour) {
        console.log("Loaded from cache.")
        return { success: true, data: recentCache, lastRefreshed }
    }

    try {
        const stored = localStorage.getItem("recentCache");
        const storedTime = localStorage.getItem("lastRefreshed");
        if (stored && storedTime) {
            const parsedTime = new Date(storedTime);
            // Cache is valid for the current hour
            if (parsedTime.getHours() === currentHour && (new Date().getTime() - parsedTime.getTime()) < 3600000) {
                console.log("Loaded from localStorage.");
                recentCache = JSON.parse(stored);
                lastRefreshed = parsedTime;
                return { success: true, data: recentCache, lastRefreshed };
            }
        }
    } catch (e) {
        console.error("Failed to read from localStorage", e);
    }

    const result = await pullRecent()
    if (!result) return { success: false, data: [], lastRefreshed: null }

    recentCache = result
    lastRefreshed = new Date()

    try {
        localStorage.setItem("recentCache", JSON.stringify(recentCache));
        localStorage.setItem("lastRefreshed", lastRefreshed.toISOString());
    } catch (e) {
        console.error("Failed to write to localStorage", e);
    }

    return { success: true, data: recentCache, lastRefreshed }
}

export async function getDatabase() {
    const result = await pullUpdateBackend()
    console.log("raw result:", result)
    if (!result) return { success: false, data: [] }
    recentCache = result  
    lastRefreshed = new Date()
    return { success: true, data: result }
}


export function clearCache() {
  recentCache = []
  lastRefreshed = null
  Object.keys(jobCache).forEach(key => delete jobCache[key])  
}





