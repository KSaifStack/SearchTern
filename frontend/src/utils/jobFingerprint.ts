/**
 * Generates a stable, content-based fingerprint for a job listing.
 *
 * Backend numeric IDs are reassigned every hour when the job feed refreshes,
 * so they cannot be used as bookmark keys. This fingerprint is derived from
 * fields that stay constant across refreshes (company, role, location), making
 * bookmarks survive ID rotation, page refreshes, and localStorage loads.
 *
 * Example output: "google|software engineer intern|mountain view ca"
 */
export function makeJobFingerprint(
    company: string,
    role: string,
    location: string
): string {
    const normalize = (s: string) =>
        s
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, '') // strip punctuation
            .replace(/\s+/g, ' ')         // collapse whitespace
            .trim();

    return `${normalize(company)}|${normalize(role)}|${normalize(location)}`;
}
