import { rewrite } from "@vercel/edge";

export const config = { runtime: "edge" };

const SITE = "https://searchtern.ksaif.dev";
const API = process.env.VITE_API_URL || "http://127.0.0.1:8000";

const BOT_RE = /discord|slack|twitter|facebookexternalhit|facebookbot|telegram|whatsapp|linkedin|pinterest|embeds|curl|python-requests/i;

function esc(s: string) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function jobMeta(id: string) {
    const res = await fetch(`${API}/jobs/${id}`);
    if (!res.ok) return null;
    const data = await res.json();
    const j = data?.result;
    if (!j) return null;
    return {
        title: `${j.role} | ${j.company} | SearchTern`,
        description: `${j.role} at ${j.company} in ${j.location || "remote/US"}. ${j.type === "newgrad" ? "New-grad" : "Internship"} opportunity. Apply directly through the employer.`,
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
<meta http-equiv="refresh" content="0;url=${location}" />
</head>
<body></body>
</html>`;

    return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}