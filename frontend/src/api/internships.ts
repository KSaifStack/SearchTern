const api_key = import.meta.env.VITE_API_KEY;
const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

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