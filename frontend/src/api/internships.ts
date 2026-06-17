import { supabase } from '../lib/supabase';

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

// pulls recent internships directly from Supabase
export async function pullRecent(){
  if (!supabase) {
    console.log("Supabase URL or Key missing. Falling back to local backend API.");
    try {
      const res = await fetch(`${BASE_URL}/recent`);
      const data = await res.json();
      return data.result || [];
    } catch (e) {
      console.error("Error fetching recent internships from local backend:", e);
      return [];
    }
  }

  const { data, error } = await supabase
    .from('internships')
    .select('*')
    .order('date');
  
  if (error) {
    console.error("Error fetching from Supabase:", error);
    return [];
  }
  return data;
}

// pulls internships based off location directly from Supabase
export async function pullLocation(searchterm:String){
  if (!supabase) {
    console.log("Supabase URL or Key missing. Falling back to local backend API.");
    try {
      const res = await fetch(`${BASE_URL}/location?searchterm=${encodeURIComponent(searchterm.toString())}`);
      const data = await res.json();
      return data.result || [];
    } catch (e) {
      console.error("Error fetching location search from local backend:", e);
      return [];
    }
  }

  const { data, error } = await supabase
    .from('internships')
    .select('*')
    .ilike('location', `%${searchterm}%`)
    .order('date');

  if (error) {
    console.error("Error fetching location from Supabase:", error);
    return [];
  }
  return data;
}

// pulls internships based off keyword directly from Supabase
export async function pullKeyword(searchterm:String){
  if (!supabase) {
    console.log("Supabase URL or Key missing. Falling back to local backend API.");
    try {
      const res = await fetch(`${BASE_URL}/keywords?searchterm=${encodeURIComponent(searchterm.toString())}`);
      const data = await res.json();
      return data.result || [];
    } catch (e) {
      console.error("Error fetching keyword search from local backend:", e);
      return [];
    }
  }

  const { data, error } = await supabase
    .from('internships')
    .select('*')
    .ilike('role', `%${searchterm}%`)
    .order('date');

  if (error) {
    console.error("Error fetching keyword from Supabase:", error);
    return [];
  }
  return data;
}

// checks health of the ThinkPad scraper
export async function checkHealth() {
  try {
    const res = await fetch(`${BASE_URL}/health`);
    const data = await res.json();
    return data;
  } catch (err) {
    return { status: "error", next_scrape: "unknown" };
  }
}
