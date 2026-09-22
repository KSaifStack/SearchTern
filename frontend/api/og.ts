export const config = { runtime: "edge" };

const SITE = "https://searchtern.ksaif.dev";
const API = process.env.VITE_API_URL || "http://127.0.0.1:8000";
const DEFAULT_TITLE = "SearchTern — Software Internship & New-Grad Job Tracker";
const DEFAULT_DESC = "Find thousands of active software internships and new-grad jobs, then track your applications in one place.";

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
    const id = url.searchParams.get("id") || "";

    const spa = await fetch(`${SITE}/index.html`);
    let html = await spa.text();

    const meta = id ? await jobMeta(id) : null;

    const title = meta ? meta.title : DEFAULT_TITLE;
    const desc = meta ? meta.description : DEFAULT_DESC;
    const pageUrl = meta ? `${SITE}/jobs/${id}` : SITE;

    html = html
        .replaceAll(DEFAULT_TITLE, esc(title))
        .replaceAll(DEFAULT_DESC, esc(desc))
        .replace(`content="${SITE}"`, `content="${pageUrl}"`);

    if (meta) {
        html = html.replace("</head>", `<script type="application/ld+json">${JSON.stringify(meta.jsonLd)}</script>\n</head>`);
    }

    return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });

}