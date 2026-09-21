import { rewrite } from "@vercel/edge";

export const config = { runtime: "edge" };

const SITE = "https://searchtern.ksaif.dev";
const API = process.env.VITE_API_URL || "http://127.0.0.1:8000";

const BOT_RE = /discord|slack|twitter|facebook|telegram|whatsapp|linkedin|pinterest|googlebot|bingbot|yandex|baiduspider|duckduckbot|applebot|satori|oEmbed|embed|curl|wget|python-requests|headless/i;

function esc(s: string) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function postedDate(daysValue: string | number): string | undefined {
    const days = parseFloat(String(daysValue));
    if (isNaN(days)) return undefined;
    return new Date(Date.now() - days * 86400e3).toISOString().slice(0, 10);
}

async function jobMeta(id: string) {
    const res = await fetch(`${API}/jobs/${id}`);
    if (!res.ok) return null;
    const data = await res.json();
    const j = data?.result;
    if (!j) return null;
    const desc = `${j.role} in ${j.location || "remote/US"}. Apply directly through ${j.company}.`;
    return {
        title: `${j.role} | ${j.company} | SearchTern`,
        description: desc,
        jsonLd: {
            "@context": "https://schema.org",
            "@type": "JobPosting",
            title: j.role,
            description: desc,
            datePosted: postedDate(j.date),
            hiringOrganization: { "@type": "Organization", name: j.company },
            jobLocation: {
                "@type": "Place",
                address: { "@type": "PostalAddress", addressLocality: j.location },
            },
            directApply: true,
        },
    };
}

export default async function handler(req: Request) {
    const url = new URL(req.url);
    const ua = req.headers.get("user-agent") || "";

    if (!BOT_RE.test(ua)) return rewrite(`${SITE}/index.html`);

    const id = url.searchParams.get("id") || "";
    const meta = id ? await jobMeta(id) : null;
    if (!meta) return rewrite(`${SITE}/index.html`);

    const location = `${SITE}/jobs/${id}`;
    const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${esc(meta.title)}</title>
<meta name="description" content="${esc(meta.description)}" />
<link rel="canonical" href="${location}" />
<meta property="og:type" content="website" />
<meta property="og:title" content="${esc(meta.title)}" />
<meta property="og:description" content="${esc(meta.description)}" />
<meta property="og:url" content="${location}" />
<meta property="og:image" content="${SITE}/favicon.png" />
<meta name="twitter:card" content="summary" />
<script type="application/ld+json">${JSON.stringify(meta.jsonLd)}</script>
</head>
<body></body>
</html>`;

    return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}