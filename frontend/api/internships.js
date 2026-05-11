// This test frontend to backend(fastapi)
fetch("http://localhost:8000/test")
  .then(res => res.json())
  .then(data => {
    console.log(data.message); 
  })
  .catch(err => console.error("Fetch failed:", err));

// pulls update Backend data via fastapi  
async function pullUpdateBackend() {
  const res = await fetch("http://localhost:8000/update");
  const data = await res.json();
  return data.result;
}
// pulls recent internships via fastapi
async function pullRecent(){
  const res = await fetch("http://localhost:8000/recent");
  const data = await res.json();
  return data.result;
}

// pulls internships based off location via fastapi
async function pullLocation(searchterm){
    const res = await fetch("http://localhost:8000/location?searchterm=" + searchterm);  
    const data = await res.json();
  return data.result;
}

// pulls internships based off keyword via fastapi
async function pullKeyword(searchterm){
    const res = await fetch("http://localhost:8000/keywords?searchterm=" + searchterm);
    const data = await res.json();
    return data.result;
}


//Function tests
const result = await pullUpdateBackend();
const keywordtest = await pullLocation("Charlotte");
console.log(keywordtest);

