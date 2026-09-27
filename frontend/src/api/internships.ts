// Same-origin by default: vercel rewrites /backend/* to the API host in prod,
// the vite dev proxy forwards it to 127.0.0.1:8000. Keeps the browser on one
// hostname so users behind restrictive HTTP proxies can still reach the API.
const BASE_URL = import.meta.env.VITE_API_URL || "/backend";

// The search index. Served from the CDN (see api/index.ts) and sliced, so
// browsing and searching never reach the backend.
const INDEX_URL = "/jobs.json";

// subset of a job row the backend returns for same-company lookups
export interface Job {
    id: number
    company: string
    role: string
    location: string
    link: string
    date: number | string
    type?: string
    season?: string
    ats?: string | null
    description?: string | null
}

// One slice of the search index. The list is split so the browser can render
// the first slice immediately and pull the rest in parallel — see
// services/internshipmanager.ts. No backend request, no search round trip.
export interface IndexSlice {
  jobs: Job[]
  total: number
  parts: number
  /** set when the slice could not be fetched, so callers can say so */
  error?: string
}

export async function pullIndexSlice(part: number, parts: number): Promise<IndexSlice> {
  try {
    const res = await fetch(`${INDEX_URL}?part=${part}&parts=${parts}`);
    if (!res.ok) return { jobs: [], total: 0, parts: 1, error: `HTTP ${res.status}` };
    const data = await res.json();
    return {
      jobs: data.result || [],
      total: typeof data.count === 'number' ? data.count : 0,
      parts: typeof data.parts === 'number' ? data.parts : parts,
    };
  } catch (e) {
    console.error(`Error fetching job index slice ${part}:`, e);
    return { jobs: [], total: 0, parts: 1, error: e instanceof Error ? e.message : 'network error' };
  }
}

// pulls a single listing by id for /jobs/:id detail pages
export async function pullJob(id: number | string){
  try {
    const res = await fetch(`${BASE_URL}/jobs/${id}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.result || null;
  } catch (e) {
    console.error("Error fetching job by id:", e);
    return null;
  }
}

// listing count for the counter badge — a 15-byte response, not an index slice
export async function pullCount(){
  try {
    const res = await fetch(`${BASE_URL}/count`);
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.result === 'number' ? data.result : null;
  } catch (e) {
    console.error("Error fetching listing count:", e);
    return null;
  }
}

// resolves a tracked job's current numeric id (fingerprint → live id) for deep links
export async function pullLookup(company: string, role: string, location: string){
  try {
    const url = `${BASE_URL}/jobs/lookup?company=${encodeURIComponent(company)}&role=${encodeURIComponent(role)}&location=${encodeURIComponent(location)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return (data?.result?.id) ?? null;
  } catch (e) {
    console.error("Error looking up job id:", e);
    return null;
  }
}

// pulls all open roles at a company (job detail "more from this company" panel)
export async function pullCompany(name: string): Promise<Job[]> {
  try {
    const res = await fetch(`${BASE_URL}/company?name=${encodeURIComponent(name)}`);
    const data = await res.json();
    return data.result || [];
  } catch (e) {
    console.error("Error fetching company listings from backend:", e);
    return [];
  }
}

// checks health of the scraper
export async function checkHealth() {
  try {
    const res = await fetch(`${BASE_URL}/health`);
    const data = await res.json();
    return data;
  } catch (err) {
    return { status: "error", next_scrape: "unknown" };
  }
}

// pulls the list of data sources the backend scrapes from
export async function fetchSources() {
  try {
    const res = await fetch(`${BASE_URL}/sources`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return Array.isArray(data?.sources) ? data.sources : [];
  } catch (err) {
    console.error("Error fetching data sources from backend:", err);
    return [];
  }
}