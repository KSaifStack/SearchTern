// Fetches the search index in slices so the page is usable before the whole
// list has landed. The browser caches each slice (max-age=300) and the CDN
// caches them an hour (s-maxage=3600), so the hourly refresh is a handful of
// 304s rather than a full re-download.
import { pullIndexSlice, type Job } from "../api/internships.ts";

export interface IndexSnapshot {
    jobs: Job[]
    /** rows held so far */
    loaded: number
    /** rows the index actually has */
    total: number
    /** false while the remaining slices are still in flight */
    complete: boolean
    /** set when the index could not be loaded at all */
    error?: string
}

// 4 slices keeps the fan-out well under Vercel's 12-invocation limit and makes
// the first slice ~25% of the list.
const SLICES = 4

let cached: IndexSnapshot | null = null
let cachedAt = 0

function isCurrentHour(ts: number): boolean {
    const hourStart = new Date()
    hourStart.setMinutes(0, 0, 0)
    return ts >= hourStart.getTime()
}

/**
 * Load the index. `onProgress` fires as soon as the first slice is in (so the
 * caller can render), then again when every slice has merged. While
 * `complete` is false the caller's filters run against a partial list, which is
 * why Jobs.tsx shows a progress count rather than a final tally.
 */
export async function getRecent(onProgress?: (snap: IndexSnapshot) => void): Promise<IndexSnapshot> {
    if (cached && isCurrentHour(cachedAt)) {
        onProgress?.(cached)
        return cached
    }

    const first = await pullIndexSlice(1, SLICES)
    // A failed first slice is the only unrecoverable case: there is nothing to
    // render and nothing to retry into. Report it instead of returning zero
    // rows, which reads as "we have no jobs" rather than "we are broken".
    if (first.error) {
        const failed: IndexSnapshot = { jobs: [], loaded: 0, total: 0, complete: true, error: first.error }
        onProgress?.(failed)
        return failed
    }
    const parts = first.total > 0 ? Math.max(1, first.parts) : 1
    const partial: IndexSnapshot = { jobs: first.jobs, loaded: first.jobs.length, total: first.total, complete: parts <= 1 }
    onProgress?.(partial)
    if (parts <= 1) {
        cached = partial
        cachedAt = Date.now()
        return partial
    }

    const rest = await Promise.all(
        Array.from({ length: parts - 1 }, (_, i) => pullIndexSlice(i + 2, parts))
    )
    const failedSlices = rest.filter(s => s.error)

    // Merged list must be a NEW array. `partial` already handed the caller
    // `first.jobs`, and React bails out of setState when the reference is
    // unchanged — merging in place left the first slice (2,874 rows) on the
    // jobs table forever while reporting the full count. (Bit us in prod.)
    const merged: Job[] = [...first.jobs]
    for (const slice of rest) merged.push(...slice.jobs)

    const full: IndexSnapshot = {
        jobs: merged,
        loaded: merged.length,
        total: first.total,
        complete: true,
        error: failedSlices.length ? `slice ${failedSlices.length + 1} failed` : undefined,
    }
    cached = full
    cachedAt = Date.now()
    onProgress?.(full)
    return full
}

export function clearCache() {
    cached = null
    cachedAt = 0
}

export function getSecondsUntilNextHour(): number {
    const now = new Date()
    return 3600 - (now.getMinutes() * 60 + now.getSeconds())
}
