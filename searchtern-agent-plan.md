# SearchTern Agent Companion Repo (universal apply engine)

**Status: scaffolded and verified for detection; adapters are best-effort and must be
tested against live pages before `--submit` is used on real applications.**

## What this is

A separate, local companion to SearchTern that turns its tracker into a Playwright-based
application engine for **any** job link, not just known ATS systems. It reads the user's
saved jobs + resume from SearchTern, opens each job in a real (ideally the user's own,
logged-in) browser, fills the application from a local `profile.yaml`, screenshots it, and
**stops for human review — dry-run is the default; submission is an explicit per-job opt-in.**

The companion lives at `/home/kankroid/Downloads/searchtern-agent` (on this machine;
original plan target `c:\Users\ablee\OneDrive\searchtern-agent` is Austin's, confirm before
more work). It is a git repo, local-only for now, no remote.

## Why "universal" is achievable (real architecture)

There is no single selector that applies everywhere. Coverage comes from **layers**:

1. **Your own browser, attached via CDP** — `applier/browser.py` connects to Chrome with
   `--remote-debugging-port=9222`, so SSO, 2FA, account creation and file uploads "just
   work" because the run happens inside the user's real, logged-in session. This removes
   the #1 reason custom portals break automation. Fallback: fresh headed Chromium.
2. **ATS detection** — `applier/detect.py` classifies a job URL (plus optional DOM hints)
   into: greenhouse, lever, workday, ashby, icims, smartrecruiters, avature, oracle-hcm,
   successfactors, tal, linkedin, indeed, or `generic`. Verified live against all 24 rows
   in the user's tracker.
3. **Deterministic adapters** for standard systems — `applier/adapters/`:
   `greenhouse.py` (boards + embed tokens + `gh_jid` career pages — covers Cloudflare,
   Databricks, **IFIT, Epic Games**), `workday.py` (RTX, Hartford, Capital One; best-effort,
   needs logged-in Chrome). Registry in `adapters/__init__.py` (`lever.py`/`ashby.py` are
   detection-only stubs that currently fall to the generic driver).
4. **Generic driver for everything else** — `applier/generic.py` introspects every visible
   input/select/textarea by label + name + aria-label + placeholder, maps to profile fields
   via `applier/fields.py` heuristics, fills what it resolves, answers standard questions
   from `profile.yaml.standard_answers`, uploads the resume, and reports unresolved controls.
   Future: LLM-backed mapping for ambiguous/custom questions (see TODO).
5. **Human gate + write-back** — `--submit` is per-job. Confirmed submissions can be
   reported back to SearchTern via `client.propose()` (`POST /agent/propose`), landing in
   the Agent hub for approval and updating the tracker — the existing human-in-the-loop
   loop; not wired to the UI yet.

## Data split (unchanged from earlier review)

- **Resume** lives in the user's SearchTern account (Supabase Storage, per-account). The
  applier downloads it via `/agent/resume` (`ensure_resume()` in `browser.py`) into
  `cache/resumes/` and uploads it to forms; the backend returns raw bytes (no text
  extraction).
- **Structured PII** (name/contact/address/EEO/work auth) lives ONLY in local
  `profile.yaml` — SearchTern stores none of it, and it never leaves the machine.
- `gather_context.py` CLI (fetching resume text: bytes are decoded locally with `pypdf`)
  is deferred until the drafting skills land (see TODO).

## Repo layout (scaffolded)

```
searchtern-agent/
  README.md                   # quickstart, safety, coverage table
  TODO.md                     # adapter list, generic-driver upgrades, propose() wiring
  requirements.txt            # requests, python-dotenv, pyyaml, playwright, pypdf
  .env.template               # SEARCHTERN_AGENT_KEY, SEARCHTERN_API_URL, APPY_CDP_ENDPOINT, APPY_DRY_RUN
  .gitignore                  # .env, profile.yaml, cache/, applications/, __pycache__/, .screenshots/, browser-profile/
  profile.template.yaml       # PII only (personal/EEO/education/experience/skills/standard_answers)
  searchtern_agent/
    config.py                 # env + path helpers
    client.py                 # search(), tracker(), health(), resume(), propose()
  applier/
    __main__.py               # CLI: apply, tracker-detect, snapshot
    detect.py                 # ATS classification (URL + DOM)
    browser.py                # CDP attach + fallback launch, screenshots, ensure_resume()
    fields.py                 # label heuristic -> profile-field map + option picker
    generic.py                # universal introspect-and-fill driver
    adapters/
      base.py                 # adapter contract + shared fill/set/upload/click helpers
      greenhouse.py           # boards + embed token + gh_jid handling
      workday.py              # best-effort data-automation-id wizard filler
      __init__.py             # registry
  cli/
    search.py tracker.py profile.py   # thin read/validate helpers
  cache/  .screenshots/  applications/   # gitignored runtime dirs
```

## Verified so far (this machine)

- `python -m applier --help` works without playwright installed (lazy imports).
- `python -m applier tracker-detect` against the live prod API classifies all 24 tracker
  rows: **7 SUPPORTED adapters** (workday ×3: RTX/Hartford/Capital One; greenhouse ×4:
  Cloudflare/Databricks/**IFIT**/**Epic Games** via `gh_jid`), 10 generic-path, 7
  known-but-unimplemented (ashby, icims, avature, oracle-hcm ×2, successfactors, tal).
- `fields.classify` resolves First Name/Email/LinkedIn/Work-authorization; `cli/profile.py`
  validates a complete `profile.yaml`.

## Realistic next steps before real applications

1. `pip install -r requirements.txt` + `python -m playwright install chromium`.
2. Write `profile.yaml` with real data (template has placeholders).
3. **Dry-run one Greenhouse job** (`python -m applier apply <cloudflare|databricks|epic|ifit url>`
   — no account needed) and one Workday job with CDP attached; inspect screenshots in
   `.screenshots/`; harden `greenhouse.py`/`workday.py` against the real DOM.
4. Test `--submit` on ONE low-stakes application, watch it land, delete that application
   if it misbehaves (employers let you withdraw). Treat `--submit` as radioactive: audit
   the dry-run screenshots first on every job.
5. Per-site anti-bot realism (see TODO "pace yourself") before any volume.

## Explicitly deferred (in `TODO.md`)

- Lever/Ashby/iCIMS/Oracle-HCM/SuccessFactors/Avature/Tal adapters.
- LLM mapper for generic driver + `--ask` mode.
- `client.propose()` write-back + `cli/report.py` (report submissions into the Agent hub).
- Confirmation detection/submission ledger; skill.md consumption.
- `gather_context.py` + local resume text decode (drafting material, not this v1).

## Safety / ToS

Dry-run by default; submissions only with `--submit`. Automating applications may violate
some sites' terms; CAPTCHAs must be stopped, not fought; each `--submit` run should be
reviewed. This is the operational spine of the whole feature.