# Brag Plan: SearchTern

## What is this app?
SearchTern finds and tracks internships without the chaos — thousands of listings pulled hourly from student-maintained GitHub repos into one searchable board, plus a drag-and-drop Kanban tracker for the whole pipeline (Saved → Applied → Interview → Offer → Rejected).

## The angle
The job hunt in 2026 is a Frankenstein system of tabs, spreadsheets, and notebooks. SearchTern is the single system that replaces all of it: the feed that finds the role and the board that tracks it. The video is a "chaos → one system" story told with the product in action. It is a real, earnest product for students — played straight and clean, no wink.

## Hook (first 2-3 seconds)
The problem, stated as a stack of facts:
`47 tabs open.` / `12 spreadsheets.` / `3 notebooks.` / `And I still missed the deadline.`
Each line slams in fast and holds. Relatable gut-punch, then the reveal reframes it.

## Key moments (the middle)
- **The board:** A real browser-window mockup of the Jobs page — company / role / location rows (Spotify, ServiceNow, Lucid, Fidelity), "2h ago" freshness, an "hourly refresh" pill, big listing count. Rows arrive one by one.
- **The drag:** Simulated cursor drags a real-looking application card across the Kanban: Saved → Applied → Interview → Offer. The Offer card lands with a green glow.
- **The stats:** Tracker stat bar — Applied, Reply rate %, Offers, Rejected — with the ring chart filling; the numbers are the reward for using the system.

## Outro / punchline
`SearchTern.` / `Thousands of internships. Zero chaos.` / `searchtern.ksaif.dev`
Logo + URL land on the strongest musical hit.

## User flow worth showing
Entry → key action → result, from the real app:
1. Browse the hourly-refreshed job board (Jobs page rows).
2. Save → Apply → drag the card forward on the Kanban (Tracker page).
3. Land it in Offer; the dashboard stats/ring reward the progress.

Centerpiece scenes are the working app, not the landing page.

## Tone
- Preset: `default`
- Creative direction: earnest, clean, slightly punchy student-tool launch. The app is a real solution, the tone is warm and confident — never corporate, never a joke.
- Interpretation: 5 scenes, comfortable 3-5s holds. Short hook lines slam in fast but hold long enough to read. Playful energy, warm green/off-white palette from the app.

## Format: landscape — 1920x1080
## Duration: ~20s

## Visual identity (from the project)
- Background: `#f8f7f4` (warm off-white page bg). Dark scenes for the hook may use `#172b4d` (text-dark) or near-black.
- Accent: `#2d7a4f` (accent) / `#3aa76d` (button) / `#3a9e6e` (primary green)
- Text: `#1a1a1a` (font) / `#172b4d` (text-dark) / `#5e6c84` (muted)
- Display font: Lexend (700/800, from the app's Google Fonts link)
- Body font: Lexend (400/600)
- Strongest visual element: the green-accented Kanban columns and the RingProgress circle

## Share copy (draft)
The 47-tab job hunt is over. SearchTern pulls thousands of internships every hour and tracks your whole pipeline in one drag-and-drop Kanban. searchtern.ksaif.dev

## Audio direction
- Role: warm upbeat bed + clean interaction accents
- Music: `happy-beats-business-moves-vol-1-by-ende-dot-app.mp3` (120 BPM, most energetic — matches the default tone)
- Music treatment: start at 0 with scene 1's first slam, volume ~0.35, fade under the final URL
- Music cue guidance: bundled preset available at skill `assets/music/cues/happy-beats-business-moves-vol-1-by-ende-dot-app.music-cues.json`. Strong cues in the 0-25s window: 16.02s, 17.02s, 17.52s, 18.52s, 20.02s, 21.01s, 22.01s, 23.02s. Beat grid runs ~every 0.5s from 3.02s (2.50s of ungridded intro). Candidate locks: Offer-card landing ~17.02s, Outro logo ~20.02s (or 22.01s). Sequential rows to snap to the grid where it doesn't outrun reading.
- Audio-reactive treatment: subtle; title glow and card presence breathe with music RMS/bass. No waveform/equalizer visuals.
- SFX posture: moderate, motion-matched. Card/row reveals on the board, a click for the simulated drag, a soft announcement cue for the Offer payoff, a final logo hit. No typing sounds needed (no per-character text).
- Audio-coupled moments: job rows popping in sequentially (card sounds), the Kanban drag (click + drop), Offer payoff (bell), logo landing (impact).
- Restraint rule: nothing loud or gimmicky — this is a real product, keep the sonic layer clean.

## Storyboard

### Scene 1 — The Chaos — 3.0s (0.0—3.0)
Hook. Dark warm background (#172b4d). Four lines slam in one at a time, ~0.7s apart, stacked with weight, Lexend 800, white: `47 tabs open.` / `12 spreadsheets.` / `3 notebooks.` / `And I still missed the deadline.` Each line holds ≥0.8s settled. The last line is the button; SFX accent per line (soft UI drop / click), building to a small hit on "missed the deadline."
Sequential/interaction: yes — four text lines arrive one by one.
Audio-coupled idea: each arrival gets a short drop/click; music starts on first slam.
Transition mood: hard cut → Scene 2.

### Scene 2 — The One System — 3.5s (3.0—6.5)
Reveal. Same dark field or warm page bg. `The 2026 job hunt doesn't need more tabs.` (hold), then it resolves: `It needs one system.` Then SearchTern wordmark in green (#3aa76d) scales in center with the tagline `Find and track internships without the chaos.` under it.
Sequential/interaction: none (single reveal sequence).
Audio intent: the reframe — music pulls forward; a soft whoosh/drop on the wordmark.
Transition mood: clean slide → Scene 3.

### Scene 3 — The Board — 4.5s (6.5—11.0)
Working-app moment 1: the Jobs page mockup. Browser window (light #fff header, #f8f7f4 body) with SearchTern nav, search/filter bar, and a scroll of real-looking rows: e.g. `Stripe — SWE Intern, Summer 2027 — Seattle, WA — 1h ago`, `Spotify — Backend Intern — NYC`, `Lucid — Firmware Intern — Newark`, `Fidelity — Quant Analyst — Boston`, `Canva — Frontend Intern — Remote`. A pill reads `Refreshed hourly`. Rows stack in one by one (0.4-0.5s stagger is fine — they're list rows, read as a scan not a sentence).
Sequential/interaction: yes — board rows arrive one by one.
Audio-coupled idea: card-slide/drop per row, ending with a waitbeat before the tracker.
Transition mood: hard cut → Scene 4.

### Scene 4 — The Kanban — 6.0s (11.0—17.0)
Working-app moment 2 (centerpiece): the Tracker page. Header `Application Tracker`, stat bar (Applied / Reply rate / Offers / Rejected + ring chart), then the board with columns Saved · Applied · Interview · Offer · Rejected. Simulated cursor grabs a card from Saved and drags it: → Applied (12.5s), → Interview (13.5s), → lands in Offer at ~17.02 (locked to strong cue). The Offer column pulses green; the Reply rate nudges up; the ring chart fills green. One card, one unmistakable win.
Sequential/interaction: yes — cursor drags a card across columns at scripted times.
Audio-coupled idea: click on grab, soft drop each time it changes column, bell on the Offer landing (17.02s strong cue), tiny chip sound mid-drag.
Transition mood: hard cut → Scene 5.

### Scene 5 — The Outro — 3.5s (17.0—20.5)
`SearchTern.` wordmark large in green on the warm bg. Second line: `Thousands of internships. Zero chaos.` URL `searchtern.ksaif.dev` in muted slate below. Logo slams at ~20.02s (strong cue); music fades under the URL.
Sequential/interaction: none.
Audio intent: payoff and close — one clean impact on the wordmark, URL appears as music fades.
Transition mood: fade to end.

**Music mood for this video:** upbeat, clean, forward-pulling.
**Audio summary:** energetic open building through the board reveal, a tight click/drag rhythm through the Kanban, one bell payoff on the offer, and a clean fade-out on the logo.

Duration check: 3.0 + 3.5 + 4.5 + 6.0 + 3.5 = 20.5s ✓ (within 15-25)