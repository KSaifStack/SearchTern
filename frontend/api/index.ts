const API = process.env.INDEX_API_URL || "https://api.searchtern.ksaif.dev";
// The public R2 index URL (https://pub-….r2.dev). When set, the list is served
// as a static object — zero egress, no origin hit per visitor — with the API
// as fallback. Full path is `${R2}/jobs.json`.
const R2 = process.env.INDEX_R2_URL || "";

export const config = { runtime: "edge" };

// Matches read_db.py's _days_ago ordering: `date` is days-ago (0 = today) as
// text, so numeric sort ascending puts newest first. Unparseable sorts last.
const daysAgo = (j: { date?: unknown }): number => {
    const v = parseFloat(String(j.date));
    return Number.isFinite(v) ? v : Infinity;
};

// The search index, served from a CDN static file. The browser slices the list
// with ?part=&parts= and filters in memory, so one upstream object read per
// edge location per hour serves every visitor. Responses stay sliced to stay
// under Vercel's function response cap; the whole file is ~4.2MB, too close to
// it to pass through whole.
export default async function handler(req: Request) {
    const q = new URL(req.url).searchParams;
    const part = parseInt(q.get("part") || "0", 10);
    const parts = Math.max(1, Math.min(parseInt(q.get("parts") || "1", 10) || 1, 8));

    try {
        const src = R2 ? `${R2}/jobs.json` : `${API}/recent`;
        const upstream = await fetch(src);
        if (!upstream.ok) throw new Error(`${src} returned HTTP ${upstream.status}`);
        const data = await upstream.json();
        const total = Array.isArray(data?.result) ? data.result.length : 0;
        let rows = Array.isArray(data?.result) ? data.result : [];

        // Out-of-range part falls back to the full list rather than an empty
        // one, matching the API contract.
        let effectivePart = part;
        let effectiveParts = parts;
        if (effectiveParts > 1 && 1 <= effectivePart && effectivePart <= effectiveParts) {
            rows = rows.slice().sort((a, b) => daysAgo(a) - daysAgo(b));
            const per = Math.ceil(total / effectiveParts);
            rows = rows.slice((effectivePart - 1) * per, effectivePart * per);
        } else {
            effectivePart = 0;
            effectiveParts = 1;
        }

        // ETag off the upstream object (R2's etag is the object MD5, so it
        // changes when the file does) plus the slice params; revalidation costs
        // a 304 without re-reading the file.
        const upstreamEtag = upstream.headers.get("etag") || String(total);
        const etag = '"' + (await sha256hex(upstreamEtag + "-" + effectivePart + "-" + effectiveParts)).slice(0, 24) + '"';
        const headers: Record<string, string> = {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=60",
            etag,
        };
        if (req.headers.get("if-none-match") === etag) {
            return new Response(null, { status: 304, headers });
        }
        const body = JSON.stringify({
            count: total,
            part: effectivePart,
            parts: effectiveParts,
            result: rows,
        });
        return new Response(body, { status: 200, headers });
    } catch (e) {
        console.error(`/api/index: ${e}`);
        return new Response(JSON.stringify({ count: 0, part: 0, parts: 1, result: [] }), {
            status: 502,
            headers: { "content-type": "application/json; charset=utf-8" },
        });
    }
}

async function sha256hex(s: string): Promise<string> {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}