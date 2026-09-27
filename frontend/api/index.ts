const API = process.env.INDEX_API_URL || "https://api.searchtern.ksaif.dev";

export const config = { runtime: "edge" };

// The search index. A straight cache in front of the backend's /recent — the
// browser slices the list with ?part=&parts= and filters in memory, so one
// upstream read per edge location per hour serves every visitor.
export default async function handler(req: Request) {
    const q = new URL(req.url).searchParams;
    const qs = new URLSearchParams();
    if (q.get("part")) qs.set("part", q.get("part")!);
    if (q.get("parts")) qs.set("parts", q.get("parts")!);
    const suffix = qs.toString() ? `?${qs}` : "";

    try {
        const res = await fetch(`${API}/recent${suffix}`, {
            headers: { "Accept-Encoding": "gzip", "If-None-Match": req.headers.get("if-none-match") || "" },
        });
        // Re-throws as a 502 below for anything but a hit or a revalidation.
        if (!res.ok && res.status !== 304) throw new Error(`/recent returned HTTP ${res.status}`);

        const headers: Record<string, string> = { "content-type": "application/json; charset=utf-8" };
        // The origin is a 14ms in-memory read, so a short CDN TTL is nearly
        // free (~960 reads/hour across all POPs) and bounds staleness to one
        // scrape cycle. A long s-maxage only buys origin CPU we don't need,
        // and leaves no way to hotfix bad data without a redeploy.
        headers["cache-control"] = "public, max-age=300, s-maxage=300, stale-while-revalidate=60";
        // Lets a client (and curl) tell which layer answered: the ETag tracks
        // the origin data, so a stale CDN copy shows up as an old ETag.
        const etag = res.headers.get("etag");
        if (etag) {
            headers.etag = etag;
            headers["x-index-etag"] = etag;
        }
        if (res.status === 304) return new Response(null, { status: 304, headers });
        return new Response(res.body, { status: res.status, headers });
    } catch (e) {
        console.error(`/api/index: ${e}`);
        return new Response(JSON.stringify({ count: 0, part: 0, parts: 1, result: [] }), {
            status: 502,
            headers: { "content-type": "application/json; charset=utf-8" },
        });
    }
}
