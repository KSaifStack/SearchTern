# SearchTern Agent Companion Repo

## Context

SearchTern already exposes a per-user "AI Agent" bridge (`/agent/search`, `/agent/tracker`, `/agent/resume`, `/agent/propose`, `/agent/health` in [backend/api.py](backend/api.py), auth via a Bearer `st_...` key generated under Settings → AI Agents). Today the only documentation of how to actually *use* that bridge is a couple of inline code comments and README bullets — there's no runnable client, no local profile format, and no guidance for turning "read a job posting" into "have my agent draft and help me submit an application." The user wants a **separate, new repo** that packages everything a person needs to point Claude Code / opencode at their own SearchTern account and start using it to find + apply to internships: setup docs for the existing 7-step key flow, a local-only file for personal/application info, and the scripts an agent shells out to.

Two design constraints (confirmed against [backend/api.py](backend/api.py), [backend/read_db.py](backend/read_db.py), and the env templates):
- **Resume comes from SearchTern; structured PII stays local.** The signed-in user's resume IS stored per-account (Supabase Storage `resumes` bucket under `{user_id}/`, synced from Settings → AI Agents) and `/agent/resume` reads it back, scoped to the key's owner via `get_agent_identity`. It returns the file's bytes (base64) plus metadata (name, id, updated_at); the backend does **not** extract PDF text, so this repo uses `pypdf` to decode text locally from the API bytes. What SearchTern does NOT store is structured PII — `tracked_jobs` only has company/role/location/link/status/notes, and there's no personal-info store at all. So: `profile.yaml` holds the user's PII (entered manually, kept entirely local), while the resume itself is pulled through `/agent/resume`.
- **Proposal decisions are applied client-side in SearchTern's own frontend** (`AgentPanel.tsx` `settle()`), not by the backend. `/agent/propose` only ever creates a proposal row; nothing in this new repo can write to the tracker directly, by design — that's the human-in-the-loop safety net staying intact.

Decisions from the user (via clarifying questions):
- **v1 scope = draft-only.** No Playwright/browser automation and no unattended form submission. The agent finds jobs, gathers profile + resume + job context, and drafts application materials for the human to review and submit manually.
- **Stack = Python**, matching SearchTern's own backend/scraper.
- **Integration = plain CLI scripts** that Claude Code / opencode invoke via their Bash tool — no MCP server for v1.
- **Explicitly deferred (tracked in `TODO.md` in the new repo, not built now):** wiring `POST /agent/propose` so the agent can report outcomes back into SearchTern's tracker/Agent hub, and consuming/generating the `skill.md` that SearchTern's planned Agent Hub page (`agent-hub-plan.md`) will offer for download.

## New repo layout

Create as a new, separate git repo at `c:\Users\ablee\OneDrive\searchtern-agent` (sibling to this repo — no changes to the existing SearchTern codebase). `git init` locally only; pushing to GitHub / creating the remote repo is left for the user to confirm and do explicitly, not automated here.

```
searchtern-agent/
  README.md                   # what this is + the 7-step SearchTern setup walkthrough + quickstart
  TODO.md                     # deferred work: /agent/propose write-back, skill.md integration
  requirements.txt            # requests, python-dotenv, pyyaml, pypdf
  .env.template                # SEARCHTERN_AGENT_KEY, SEARCHTERN_API_URL
  .gitignore                   # .env, profile.yaml, cache/, applications/, __pycache__/
  profile.template.yaml        # local personal-info (PII) schema — NO resume here, blank/example values, heavily commented
  searchtern_agent/
    __init__.py
    client.py                  # SearchTernClient: search(), tracker(), health(), resume() — GET-only wrapper against SearchTern's agent API
  cli/
    search.py                  # python cli/search.py --q "..." --location "..." --limit 25
    tracker.py                 # python cli/tracker.py  -> prints current tracker rows as JSON
    profile.py                 # python cli/profile.py check  -> validates profile.yaml (PII) is filled in
    gather_context.py          # python cli/gather_context.py --company X --role Y [--link Z]
                                #   -> combines local profile.yaml (PII) + resume text (fetched from SearchTern
                                #      via /agent/resume; PDF decoded locally with pypdf into cache/) + job info
                                #      into one JSON blob on stdout for the calling agent to read; writes nothing itself
  cache/                       # gitignored: extracted resume text cache (from the /agent/resume PDF bytes)
  applications/                # gitignored: where the agent (Claude Code/opencode) saves drafted materials it writes,
                                #   one subfolder per application, e.g. applications/Acme-SWE-Intern/
```

Key point on `gather_context.py` / drafting: the Python scripts only **fetch and assemble** data (local profile fields, local resume text, job posting fetched from SearchTern). The actual reasoning — writing a tailored cover letter or draft answers — is left to the calling agent (Claude Code/opencode), which reads the JSON context and writes files into `applications/<company>-<role>/` itself. This avoids duplicating templating/generation logic the LLM already does better, and keeps the Python side small and easy to audit.

## `searchtern_agent/client.py`

Thin `requests`-based wrapper, `Authorization: Bearer {SEARCHTERN_AGENT_KEY}` on every call, base URL from `SEARCHTERN_API_URL` (default `https://api.searchtern.ksaif.dev`):
- `search(q="", location="", limit=25)` → `GET /agent/search`
- `tracker()` → `GET /agent/tracker`
- `resume(name="")` → `GET /agent/resume` — returns the list of the user's synced resumes when `name` is empty (pick the most recent `updated_at`), or the single resume's base64 bytes + metadata (`name`, `id`, `updated_at`, `content_type`) when `name` matches (get the name from the list response, or just call `resume()` without args then use its `id`/prefix). The backend returns raw file bytes for PDFs (no text extraction), so decode to PDF/text locally with `pypdf` and cache into `cache/`.
- `health()` → `GET /agent/health`

No `propose()` method in v1. `POST /agent/propose` is intentionally deferred and called out in `TODO.md` so the write boundary is explicit in code, not just docs. The resume, by contrast, IS read from SearchTern (it lives in the user's account, scoped to the key owner); only structured PII (phone, address, EEO, work authorization ...) is manual-local in `profile.yaml` — SearchTern stores none of it, so there's nothing to fetch.

## `profile.template.yaml` + local resume file

Both local-only, gitignored once the user copies/fills them in — entered manually, never fetched from SearchTern. `profile.template.yaml` has commented sections for: `personal` (name, email, phone, address, linkedin, github, portfolio), `education` (list), `experience` (list), `skills`, `work_authorization` (visa status, sponsorship needs, US work authorization), and `eeo` (optional, blank by default — gender/race/veteran/disability). No `resume_path` field and no local resume file: the resume itself is read from SearchTern via `/agent/resume` (see `client.resume()`), so the user just makes sure it's synced under Settings → AI Agents. File header explicitly states: this data never leaves the machine except to be read by the local agent — it is never sent to SearchTern, and SearchTern never stores structured PII like this to begin with.

## README.md content

Mirrors the user's existing 7-step flow, adapted:
1. Create a SearchTern account at searchtern.ksaif.dev.
2. Settings → AI Agents → enable agents (and "Show tracker tab" if desired).
3. Create an agent key (`st_...`), copy it — shown once.
4. Clone this repo, `pip install -r requirements.txt`, `cp .env.template .env` and paste the key in.
5. `cp profile.template.yaml profile.yaml` and fill in personal info manually (names, contact, experience, skills, work authorization, optional EEO). The resume is NOT stored here — it's read from your SearchTern account via `/agent/resume`, so make sure it's synced under Settings → AI Agents first. PII never leaves this machine except to the local agent.
6. Point Claude Code / opencode at this repo folder; example prompt given for "search SearchTern for X, gather context for a role, draft application materials into `applications/...`."
7. Review/submit manually; approve or reject anything that does show up as a proposal in SearchTern's own Agent hub as before. Note (linked to `TODO.md`) that v1 does not yet auto-report submitted applications back to SearchTern — the user still updates their own tracker in the SearchTern UI for now.
8. Stop the agent anytime: revoke the key in Settings → AI Agents, or just delete the local `.env`.

## TODO.md content (the deferred list)

- **Connect back to the SearchTern database** — implement `client.propose()` (`POST /agent/propose`, `tool="apply"`/`"update_status"`) and a `cli/report.py` so that after a human confirms they submitted an application, the agent can report it and it appears in SearchTern's Agent hub for approval, respecting the existing allow/ask/block policy system (`backend/read_db.py` `evaluate_agent_proposal`).
- **Skill.md integration** — SearchTern's planned Agent Hub page (`agent-hub-plan.md`, not yet built) will offer a downloadable Claude Code `skill.md` (`frontend/src/utils/skillFile.ts`, YAML frontmatter + body). Once that exists, wire this repo to consume it (or ship an equivalent) so Claude Code/opencode auto-discover these CLI tools without manual prompting.
- (Noted but not committed to) full browser-automation submission via Playwright, if the user later wants true unattended apply — explicitly out of scope for v1 per the "draft-only" decision.

## Verification

1. `cd searchtern-agent && pip install -r requirements.txt` succeeds.
2. With a real `.env` (agent key from a signed-in SearchTern account) and `profile.yaml`/local resume filled in: `python cli/search.py --q "software engineer intern" --limit 5` returns real results as JSON.
3. `python cli/tracker.py` returns the signed-in user's actual tracker rows.
4. `python cli/profile.py check` correctly flags missing required fields when incomplete, and passes when filled in.
5. `python cli/gather_context.py --company "Acme" --role "SWE Intern"` prints a single JSON blob containing local profile PII + resume text (decoded locally with `pypdf` from the `/agent/resume` PDF bytes into `cache/`) + job info fetched from SearchTern.
6. Manually drive Claude Code against the repo with a prompt like "search for X, pick one, gather context, draft materials into applications/" and confirm it produces a sensible `applications/<company>-<role>/` folder without attempting any network submission.
7. Confirm `.env`, `profile.yaml`, `cache/`, and `applications/` are all gitignored (`git status` shows them untracked/ignored) before any commit.
