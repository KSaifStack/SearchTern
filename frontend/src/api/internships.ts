const api_key = import.meta.env.VITE_API_KEY;// 127.0.0.1 not localhost: dev backend binds IPv4-only and the browser may
// resolve "localhost" to ::1 first, which gets connection-refused.
const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

// subset of a job row the backend returns for same-company lookups
export interface Job {
    id: number
    company: string
    role: string
    location?: string
    link: string
    date: number | string
    type?: string
    season?: string
    ats?: string | null
}

// pulls update Backend data via fastapi (ThinkPad)
export async function pullUpdateBackend() {
  const res = await fetch(`${BASE_URL}/update`, {
    method: "POST",
    headers: {
      "X-API-Key": api_key,   // Same key as in .env
    }
  })
  console.log(res.status)
  const data = await res.json()
  return data.result
}

// pulls all recent listings via FastAPI backend
export async function pullRecent(){
  try {
    const res = await fetch(`${BASE_URL}/recent`);
    const data = await res.json();
    return data.result || [];
  } catch (e) {
    console.error("Error fetching recent listings from backend:", e);
    return [];
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

// live listing count for the counter badge
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

// pulls internships based off location via FastAPI backend
export async function pullLocation(searchterm:String){
  try {
    const res = await fetch(`${BASE_URL}/location?searchterm=${encodeURIComponent(searchterm.toString())}`);
    const data = await res.json();
    return data.result || [];
  } catch (e) {
    console.error("Error fetching location search from backend:", e);
    return [];
  }
}

// pulls internships based off keyword via FastAPI backend
export async function pullKeyword(searchterm:String){
  try {
    const res = await fetch(`${BASE_URL}/keywords?searchterm=${encodeURIComponent(searchterm.toString())}`);
    const data = await res.json();
    return data.result || [];
  } catch (e) {
    console.error("Error fetching keyword search from backend:", e);
    return [];
  }
}

// pulls all open roles at a company (job detail "more from this company" panel)
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