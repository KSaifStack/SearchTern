// This test frontend to backend(fastapi)
fetch("http://localhost:8000/test")
  .then(res => res.json())
  .then(data => {
    console.log(data.message); 
  })
  .catch(err => console.error("Fetch failed:", err));

// pulls update Backend data via fastapi  
export async function pullUpdateBackend() {
    const res = await fetch("http://localhost:8000/update", {
        method: "GET"
    })
    console.log(res.status)
    const data = await res.json()
    return data.result
}

// pulls recent internships via fastapi
export async function pullRecent(){
  const res = await fetch("http://localhost:8000/recent");
  const data = await res.json();
  return data.result;
}

// pulls internships based off location via fastapi
export async function pullLocation(searchterm:String){
    const res = await fetch("http://localhost:8000/location?searchterm=" + searchterm);  
    const data = await res.json();
  return data.result;
}


// pulls internships based off keyword via fastapi
export async function pullKeyword(searchterm:String){
    const res = await fetch("http://localhost:8000/keywords?searchterm=" + searchterm);
    const data = await res.json();
    return data.result;
}


//Function tests
pullUpdateBackend();

