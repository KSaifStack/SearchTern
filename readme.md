<h1> SearchTern </h1> 


<h2> The all in one platform to find internships for college students</h2>
<div> In this day in age finding a internship has never been harder.</div>
<div>students are sending out <strong>500–1000+ applications</strong> just to land one internship. 
The process is exhausting, unorganized, and overwhelming.</div>
<div> SearchTern aims to break this cycle by not just giving a hub for students but teach them the skills to find the right jobs.</div> 

<h2> Demo </h2>
<p>Coming soon</p>

<h2>Features</h2>
<ul>
<li>Live Job Board — 500+ internships auto-refreshed hourly</li>
<li>Application Tracker — manage every application in one place</li>
<li>AI Resume Grader — STAR method feedback scored 1-10</li>
<li>Resource Hub — AI curated CS practice sites and market trends</li>
</ul>


<h2>Tech Stack</h2>
<ul>
<li>Scraper — Python, BeautifulSoup, Requests</li>
<li>Database — PostgreSQL</li>
<li>Backend — FastAPI</li>
<li>Frontend — React, shadcn/ui, Recharts</li>
<li>Auth — JWT, bcrypt</li>
<li>AI — Unknown at the moment</li>
</ul>

<h2>Build Instructions</h2>
<p>Prerequisites: Python 3.8+, Node.js 16+, PostgreSQL</p>

<ol>
<li>Clone the repository and navigate to the project directory.</li>
<li>Install backend dependencies:
<pre><code>cd backend
pip install -r requirements.txt</code></pre>
</li>
<li>Install frontend dependencies:
<pre><code>cd ../frontend
npm install</code></pre>
</li>
<li>Set up the database (PostgreSQL) and configure connection in backend code.</li>
<li>Run the backend server:
<pre><code>cd ../backend
uvicorn api:app --reload</code></pre>
</li>
<li>In a new terminal, run the frontend development server:
<pre><code>cd frontend
npm run dev</code></pre>
</li>
<li>Open <a href="http://localhost:5173">http://localhost:5173</a> in your browser for the frontend, and the backend will be available at <a href="http://localhost:8000">http://localhost:8000</a>.</li>
</ol>
<p>Alternatively, use the provided <code>start.sh</code> script after installing dependencies (ensure uvicorn and vite are available globally or adjust paths).</p>