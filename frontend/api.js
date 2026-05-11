// This test frontend to backend(fastapi)
fetch("http://localhost:8000/test")
  .then(res => res.json())
  .then(data => {
    console.log(data.message); 
  })
  .catch(err => console.error("Fetch failed:", err));

// pulls update Backend data from fastapi  
async function pullUpdateBackend() {
  const res = await fetch("http://localhost:8000/update");
  const data = await res.json();
  return data.result;
}


//Function tests
//await allows us to take the data  
const result = await pullUpdateBackend();
console.log(result);

