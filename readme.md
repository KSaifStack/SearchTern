<h1>SearchTern </h1> 

<h2>The all-in-one platform for college students to find, track, and land internships.</h2>
<div><strong>In today's tech market, finding an internship has never been harder.</strong></div>
<br>
<div>Students frequently send out 500–1000+ applications just to land a single offer. 
The process is exhausting, unorganized, and overwhelming, often requiring students to check multiple GitHub repositories and job boards daily just to keep up.</div>
<br>
<div>SearchTern aims to break this cycle. It is an automated aggregation platform and personal dashboard that does the heavy lifting for you. It automatically finds the latest internships, allows you to filter and sort them, and gives you the tools to manage your application pipeline in one place.</div> 

<h2>How does SearchTern work?</h2>
<ol>
<li><strong>Automated Scraping:</strong> The Python backend uses an automated scheduler to scrape <a href="https://github.com/SimplifyJobs/Summer2026-Internships">SimplifyJobs Summer 2026 Internships</a> repository at every hour.</li>
<li><strong>Local Database:</strong> The scraped jobs are cleaned, formatted, and stored in a local SQLite database, ensuring lightning-fast search and filter capabilities without relying on third-party APIs.</li>
<li><strong>Live Dashboard:</strong> The React/TypeScript frontend provides a clean, responsive UI to browse, search (by keyword, location, or company), and sort the most recent listings.</li>
</ol>

<h2> Features</h2>
<h3>Currently Implemented:</h3>
<ul>
<li><strong>Live Job Board</strong> — Hundreds of internships automatically scraped and refreshed hourly and shown on the frontend 1 second after the scrape completes.</li>
<li><strong>Smart Search & Filter</strong> — Instantly filter jobs by company, role, or location.</li>
<li><strong>Pagination & Sorting</strong> — Sort by newest or oldest listings for easy browsing.</li>
</ul>

<h3>Coming Soon:</h3>
<ul>
<li><strong>Application Tracker</strong> — Manage every application, interview stage, and offer in a personalized Kanban/Table view.</li>
<li><strong>Saved Jobs</strong> — Bookmark jobs you want to apply to later.</li>
<li><strong>AI Resume Grader</strong> — Get instant STAR-method feedback on your resume, scored 1-10.</li>
<li><strong>Resource Hub</strong> — AI-curated computer science practice sites and market trends.</li>
</ul>

<h2>Tech Stack</h2>
<ul>
<li><strong>Scraper</strong> — Python, BeautifulSoup4, Requests, APScheduler</li>
<li><strong>Database</strong> — SQLite (Currently) -> PostgreSQL (Planned for Production)</li>
<li><strong>Backend</strong> — FastAPI, Uvicorn, SlowAPI (Rate Limiting)</li>
<li><strong>Frontend</strong> — React, TypeScript, Vite, Mantine UI</li>
<li><strong>Planned Additions</strong> — JWT Auth, AI Integration</li>
</ul>

<h2>Quickstart (Running Locally)</h2>
<p><strong>Prerequisites:</strong> Python 3.8+, Node.js 16+</p>

<ol>
<li><strong>Clone the repository</strong>
<pre><code>git clone &lt;your-repo-url&gt;
cd SearchTernBase</code></pre>
</li>

<li><strong>Set up Environment Variables</strong><br>
Create the necessary <code>.env</code> files.<br>
<strong>Backend (<code>backend/.env</code>):</strong>
<pre><code>API_KEY=your_secure_random_string_here</code></pre>
<strong>Frontend (<code>frontend/.env.local</code>):</strong>
<pre><code>VITE_API_KEY=your_secure_random_string_here</code></pre>
</li>

<li><strong>Start the Application</strong><br>
SearchTern includes automated startup scripts that will install all necessary dependencies and launch both servers simultaneously in development mode.
<br><br>
<strong>On Windows:</strong><br>
Double-click <code>start.bat</code> from the project root, or run it in your terminal:
<pre><code>.\start.bat</code></pre>
<br>
<strong>On Mac/Linux:</strong>
<pre><code>chmod +x start.sh
./start.sh</code></pre>
</li>

<li><strong>Access the App:</strong>
<ul>
<li>Frontend (UI): <a href="http://localhost:5173">http://localhost:5173</a></li>
<li>Backend (API Docs): <a href="http://localhost:8000/docs">http://localhost:8000/docs</a></li>
</ul>
</li>
</ol>