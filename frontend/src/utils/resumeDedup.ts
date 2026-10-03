import type { ResumeRecord } from "../services/resumeStorage"

/**
 * Names are unique by construction (uniqueResumeName), so two local records
 * sharing one are leftovers of a sync that pulled the same cloud file twice.
 * Keep the newest of each and drop the rest.
 *
 * Lives apart from resumeStorage so it can be imported and checked on its own:
 * that module pulls in the Supabase client at load, which no plain test runner
 * here can resolve.
 */
export function dedupeByName(records: ResumeRecord[]): ResumeRecord[] {
    const newestFirst = [...records].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
    const byName = new Map<string, ResumeRecord>()
    for (const record of newestFirst) {
        const key = record.name.toLowerCase()
        if (!byName.has(key)) byName.set(key, record)
    }
    return [...byName.values()]
}