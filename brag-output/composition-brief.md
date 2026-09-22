# Hyperframes Composition Brief: SearchTern

## Objective
Create a short launch-style brag video for SearchTern — a find-and-track internships app.

## Output
- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: landscape — 1920x1080
- Duration: ~20.5s (3.0 + 3.5 + 4.5 + 6.0 + 3.5)

## Source Material
- Project root: `C:\Users\saife\Downloads\SearchTern` (also `Downloads\SearchTern-1`)
- Primary files read: `readme.md`, `frontend/src/index.css`, `frontend/src/pages/Home.tsx`, `frontend/src/pages/Tracker.tsx`, `backend/scraper.py`
- Product name: SearchTern
- Tagline / strongest claim: "Find and track internships without the chaos." — Thousands of internships, refreshed hourly
- Key UI or visual moment to recreate: the Tracker Kanban (Saved → Applied → Interview → Offer → Rejected) and the Jobs board rows
- Copy that must appear verbatim:
  - "Find and track internships without the chaos."
  - "Refreshed hourly"
  - "Application Tracker"
  - Statuses: Saved / Applied / Interview / Offer / Rejected
- Hook material (from the companion LinkedIn post): "47 tabs open. 12 spreadsheets. 3 notebooks. And I still missed the deadline."

## Creative Direction
- Tone preset: default
- Creative direction: earnest, clean, slightly punchy student-tool launch. Real product, warm confident tone, never corporate, never a joke.
- Interpretation: 5 scenes, comfortable 3-5s holds. Short hook lines slam in fast but hold ≥0.8s. Playful energy, warm green/off-white palette. Keep all text Lexend.
- Angle: The 2026 job hunt is tabs + spreadsheets + notebooks. SearchTern is the one system that replaces them — the feed finds the role, the board tracks it.
- Hook (first 2-3 seconds): `47 tabs open.` / `12 spreadsheets.` / `3 notebooks.` / `And I still missed the deadline.`
- Outro / punchline: `SearchTern.` / `Thousands of internships. Zero chaos.` / `searchtern.ksaif.dev`
- Avoid:
  - Generic SaaS language ("streamline your workflow")
  - Abstract filler visuals, gradients-as-decoration
  - Any redesign of the app's look — use its real palette and layout DNA

## Visual Identity
- Background: `#f8f7f4` (warm off-white page bg); hook scene may use `#172b4d` or near-black `#0f1a2e`
- Text: `#172b4d` (dark headings), `#5e6c84` (muted), `#1a1a1a` (body)
- Accent: `#2d7a4f` (accent), `#3aa76d` (button green), `#3a9e6e` (primary green)
- Kanban status accent colors: Saved gray `#868e96`, Applied blue `#228be6`, Interview yellow `#fab005`, Offer green `#40c057`, Rejected red `#fa5252`
- Display font: Lexend 800 (from the app's Google Fonts link — include an `@font-face`/local copy since `lint` requires a shipped local file for named families; fallback to a generic sans or use the app's Google Fonts import if Hyperframes allows remote fonts)
- Body font: Lexend 400/600
- Visual references from the project: white feature cards with `box-shadow: 0 2px 8px rgba(0,0,0,0.08)`, green pill/button with `border-radius: 4px`, Mantine-style ring progress (rounded caps, green offer segment), column tabs with count badges

## Storyboard
Use the storyboard in `brag-output/brag-plan.md` as the creative contract.

Scene summary:
1. The Chaos — 3.0s — four hook lines stack one-by-one on dark bg
2. The One System — 3.5s — "needs one system" reframe + SearchTern wordmark/tagline
3. The Board — 4.5s — Jobs page mockup, 5 real rows + "Refreshed hourly" pill, rows arrive sequentially
4. The Kanban — 6.0s — Tracker page: stat bar + ring + 5 columns; simulated cursor drags a card Saved→Applied→Interview→Offer (~17.02s payoff)
5. The Outro — 3.5s — wordmark + "Thousands of internships. Zero chaos." + URL on warm bg

## Audio
- Audio role: warm upbeat bed + clean interaction accents
- Audio arc: energetic open → building through board → tight drag rhythm → bell payoff on Offer → clean fade on logo
- Music: `assets/music/happy-beats-business-moves-vol-1-by-ende-dot-app.mp3` (120 BPM)
- Music treatment: start at 0 with scene 1's first slam; volume ~0.35; fade out under the final URL (~0.5s)
- Music cue guidance: bundled preset available — copy `happy-beats-business-moves-vol-1-by-ende-dot-app.music-cues.json` next to the music asset in `composition/assets/music/`. Strong cues in the 0-25s window: 16.02, 17.02, 17.52, 18.52, 20.02, 21.01, 22.01, 23.02. Beat grid runs ~every 0.5s from 3.02s. Candidate major locks: Offer-card landing ~17.02s; Outro logo ~20.02s (fallback 22.01s). Sequential board rows may snap to adjacent beats where it stays readable (they are scan-style rows, ≤0.5s stagger is acceptable).
- Audio-reactive treatment: subtle; title glow and card/board presence breathe with music RMS/bass. No waveform/equalizer visuals, no strobing.
- Audio-coupled moments:
  - Scene 1 — each hook line arrival gets a soft UI drop/click; final line a slightly bigger hit
  - Scene 3 — board rows pop in with card-slide/drop sounds
  - Scene 4 — click on grab, soft drop per column change, bell on the Offer landing (17.02s)
  - Scene 5 — one clean impact on the wordmark at ~20.02s
- SFX selection guidance: moderate, motion-matched, low high-frequency risk for repeated/mostly polished moments; one announcement cue (bell/heavy-safe family) for the Offer payoff; a dry impact for the logo. Use the `/brag` sfx-analysis at `C:\Users\saife\.claude\skills\brag\assets\sfx\sfx-analysis.md` for file choice.
- Exact SFX choice: your choice of filenames, timestamps, density, and volume based on the implemented animation.
- Audio files: copy chosen music + SFX into `brag-output/composition/assets/` (relative paths only).

## Hyperframes Instructions
Load the composition-building Hyperframes domain skills — `hyperframes-core` (composition contract + `data-*` timing), `hyperframes-animation` (motion), `hyperframes-creative` (design spec, beats, audio-reactive), `hyperframes-keyframes` (seek-safe keyframes), and `hyperframes-cli` (lint/check/render), all installed at `C:\Users\saife\.claude\skills\hyperframes*`. /brag is its own workflow: do not enter the `hyperframes` entry-point intent interview and do not route into its generic promo / launch-video workflow. Prefer native Hyperframes conventions over anything in /brag.

Requirements:
- Show at least one real UI element from the project: the Jobs board rows and/or the Kanban tracker are the two scenes that must show the app's actual layout (green accents, white cards, ring progress, column tabs).
- Keep all text readable in the final render (WCAG contrast gates via `check`).
- Keep the video within 15-25 seconds (target ~20.5s).
- Include the planned music/SFX layer (music + moderate SFX).
- Treat /brag audio notes as guidance, not a fixed cue sheet. Choose SFX after the visual animation exists.
- Treat music cue metadata as optional timing hints. Major reveals may move toward strong cues within ±0.15s (mark such tweens `// beat-locked: <t>`); smaller entrances may align to beats within ±0.10s (mark `// beat-grid: ...`). Use only 1-3 strong-cue locks (the Offer landing ~17.02s and outro logo ~20.02s are the natural 2).
- Use SFX to support motion: card sounds for row reveals, click + drop for the drag interaction, one bell for the Offer payoff, one impact for the logo.
- Music treatment: fade out under the final URL.
- Consider the Hyperframes audio-reactive workflow: extract audio data and modulate an existing visual subtly (title glow / card presence) when available. Note extraction failures without blocking render.
- Use local assets for audio and any runtime/media dependencies. Relative paths only — never absolute.
- Run `npx hyperframes check` before render — it is brag's single gate.

Implementation notes for the drag simulation (Scene 4): a static cursor graphic (SVG/div) moved by GSAP with hand-authored two-segment paths (grab → move → release) at scripted keyframes; on release the card snaps into the next column with a drop ease. No pointer-events, no real dnd — purely scripted animation. Track the exact drop times so the Offer landing aligns to 17.02s.