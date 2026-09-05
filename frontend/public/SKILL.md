---
name: searchtern
description: Use when the user works with SearchTern — searching or tracking internships/jobs, checking their application tracker or synced resume, applying to a job, or asking an agent to act on their SearchTern account. Triggers on "searchtern", "internships", "apply to this job", "my tracker", "agent key".
---

# SearchTern agent skill

Connect your agent to the user's SearchTern account and act on it **only through human-approved proposals**. Two capabilities:

1. **SearchTern API** (works from anywhere) — read-only queries plus `propose`, which never mutates directly.
2. **Apply companion** (local repo) — a Playwright engine that opens the real application form, fills it from the user's local `profile.yaml`, dry-runs by default, and submits only on `--submit`.

## Install this skill

Save this file as `SKILL.md` in a skill directory for the agent you use:

- **opencode (project):** `.opencode/skills/searchtern/SKILL.md`
- **opencode (global):** `~/.config/opencode/skills/searchtern/SKILL.md`
- **Claude Code / any agent:** `~/.claude/skills/searchtern/SKILL.md`

Restart the agent after installing. The key itself is still generated in SearchTern → Settings → AI Agents.

## 1. Authentication

The user generates a per-user agent key in SearchTern → **Settings → AI Agents**. It starts with `st_` and is shown exactly once at creation.

- API base URL: `https://api.searchtern.ksaif.dev`
- Auth header on every request: `Authorization: Bearer st_...`
- Local dev backend: `http://localhost:8000`

## 2. SearchTern API

### Health

```
GET /agent/health
```

### Search internships

```
GET /agent/search?q=<query>&location=<location>&limit=<n>
```

Returns a list of live internships from the board.

### Read the tracker

```
GET /agent/tracker
```

Returns the user's saved jobs with their current status (`Saved`, `Applied`, `Interview`, `Offer`, `Rejected`), plus links.

### Read the synced resume

```
GET /agent/resume            # list available resumes
GET /agent/resume?name=<n>   # raw file bytes of one resume
```

### Propose an action (human-approved, never direct)

```
POST /agent/propose
Content-Type: application/json
Authorization: Bearer st_...
{
  "tool": "add_to_tracker" | "update_status" | "apply",
  "payload": { ... },
  "note": "optional human-readable note"
}
```

`propose` **never mutates the tracker directly**. It creates a proposal that the user approves in the Agent hub (trailer) or tracker overlay. Server-side per-user policies (`allow` / `ask` / `block`) are evaluated automatically at propose time:

- `allow` → proposal is auto-approved and the tracker is updated immediately.
- `ask` → proposal stays `pending` for the user.
- `block` → request is rejected (`403`).

Payload examples:

```json
{ "tool": "add_to_tracker", "payload": { "company": "Acme", "role": "SWE Intern", "location": "Remote", "link": "https://..." } }
```

```json
{ "tool": "update_status", "payload": { "company": "Acme", "role": "SWE Intern", "status": "Applied" } }
```

For an **apply** proposal, carry the real outcome in `payload.result` so the hub can show a badge and a "needs your input" queue:

```json
{
  "tool": "apply",
  "payload": {
    "company": "Acme",
    "role": "SWE Intern",
    "location": "Remote",
    "link": "https://...",
    "result": {
      "outcome": "submitted | needs_input | blocked | already_applied | pending | error",
      "summary": "human-readable result line",
      "fields_needed": ["grad year", "reference"],
      "portal": "greenhouse | lever | workday | custom | ...",
      "submission_id": "optional portal confirmation id",
      "require_resume": false,
      "require_cover_letter": false
    }
  }
}
```

Everything except `tool`, `company`, and `role` is optional; omit `result` → `outcome` defaults to `pending`.

## 3. Applying to jobs (apply companion)

For actually filling and submitting application forms, use the local companion repo:

- Repo: `github.com/KSaifStack/search-agent` (clone it onto the user's machine; setup in its README).
- Reads the user's saved jobs + resume from SearchTern, then drives a real browser.
- Attaches to the user's own logged-in Chrome via CDP (`--remote-debugging-port=9222`) so SSO/2FA/uploads work; otherwise launches a fresh headed browser.
- **Dry-run by default.** `--submit` is an explicit per-job opt-in.

Core commands:

```
python -m applier tracker-detect                 # which tracker jobs are automatable
python -m applier apply "<job-url>" --company X  # fill + screenshot, do NOT submit
python -m applier apply "<job-url>" --submit --report   # submit then report to SearchTern
python -m applier run-all                         # batch sweep; gated, nothing auto-submits
python -m applier snapshot "<job-url>"            # dump form controls (adapter dev)
```

After a confirmed submission, `--report` (or `cli/report.py`) posts an `apply` proposal with `outcome: "submitted"` — the user approves it in the Agent hub and it lands in the tracker. When the form can't be fully resolved, report `outcome: "needs_input"` with `fields_needed` named.

## Safety rules (do not skip)

- The only server-side mutation path is `propose`; there is no direct update endpoint.
- Application filling is local and dry-run by default; submitting requires the user's explicit per-job `--submit`.
- Stop, don't fight, CAPTCHAs or bot walls; if a page blocks automation, report `outcome: "blocked"` instead of forcing through.
- Pace submissions (match the companion's pacing defaults) and never spam.
- The agent key is private and per-user; never log it, commit it, or share it.