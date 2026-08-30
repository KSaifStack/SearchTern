# Agent Hub: dedicated full tab + minimalist quick-access drawer + setup docs & skill.md download

## Context

The "Agent Hub" (rules/policies, pending proposal approvals, connection health, activity feed for a user's connected AI agent) currently only exists as a slide-over drawer (`AgentPanel.tsx`) toggled from inside the Tracker page. The user wants a full dedicated top-level tab that holds everything, **plus** the existing drawer kept — but trimmed down to a minimal quick-glance view (pending proposals, connection status, and a read-only summary of already-established rules), so users get fast access from the Tracker without leaving the page, while the dedicated tab remains the full-featured home for configuration.

Two new sections are also added to the dedicated tab, scaffolded now with real copy supplied later:
1. **Local Setup Documentation** — placeholder now, real "how to run an agent locally against your account" content later.
2. **Download skill.md** — a button that generates/downloads a `skill.md` template (Claude Code skill format: YAML frontmatter + body), placeholder TODO content now.

The floating global FAB (`AgentOverlay.tsx`, a separate always-mounted quick-approval popup rendered in `App.tsx`) is untouched — different feature. No backend or `api/agent.ts` changes are required.

## Architecture decision

Both the drawer and the dedicated tab need the same underlying data/actions (proposals, policies, activity, health, keys) but render very different amounts of UI. Rather than duplicate all the fetching/state/handler logic, extract it into a shared hook that both components call independently:

**New: `frontend/src/hooks/useAgentHub.ts`** — pulls out nearly all of `AgentPanel.tsx`'s current internal logic: state (`pending`, `policies`, `activity`, `health`, `keys`, `busyIds`, `saving`, rule-builder draft fields, `statusFilter`), the refresh/poll effect (made unconditional — no longer gated by a drawer `open` prop), and handlers (`settle`, `setBaseAction`, `addRule`, `removePolicy`, connection-status derivation). Returns everything both UIs need. Shared constants/icons (`TOOLS`, `TOOL_META`, `describe()`, `matchLabel()`) move alongside it (or a small sibling file, since `TOOL_META` holds JSX icons) so neither component redefines them.

## Implementation

**1. Trim the drawer — [AgentPanel.tsx](frontend/src/components/AgentPanel.tsx)**
Keep this file, its `open`/`onClose` props, its close button/ESC handling, and its existing fixed-position slide-over CSS — it's still a real drawer, unchanged in [Tracker.tsx](frontend/src/pages/Tracker.tsx) (no changes needed there: keep `showAgentTab`, `agentTabOpen`, `pendingCount` state, the toggle button + badge, `tracker-hub-open` class, and the `<AgentPanel open={agentTabOpen} onClose={...} />` render line exactly as they are today).
Switch its internals to call `useAgentHub()` and trim its rendered JSX down to only:
- Connection status banner (compact, existing status-pill logic)
- **Proposals** ("Proposes") section — full functionality retained (Approve/Reject/Always/Never), since these are time-sensitive actionable items
- A **read-only rules summary** — one row per tool showing its current base action as a badge (derived from `policies`), no add/edit/delete controls
- Footer: keep the Pause/Resume toggle (quick, high-value); replace the "Agent settings" link with **"Manage rules & activity → Agent Hub"** (`useNavigate` to `/agent-hub`)
- Remove: the custom rule-builder form, the editable rule list with delete, and the activity feed — these move exclusively to the dedicated tab.

**2. New dedicated tab — `frontend/src/pages/AgentHub.tsx` (new file)**
Register in [App.tsx](frontend/src/App.tsx) route list:
```jsx
<Route path="/agent-hub" element={<main className="standard-layout"><AgentHub /></main>} />
```
Add nav link in [Navbar.tsx](frontend/src/components/Navbar.tsx) `.nav-left` (~lines 50-52), after "Applications", matching the existing pattern:
```jsx
<li><Link to="/agent-hub" className={location.pathname === '/agent-hub' ? 'active' : ''} onClick={() => setMenuOpen(false)}>Agent Hub</Link></li>
```
Page renders a header ("Agent Hub" + `Robot` icon) then three `.settings-section` blocks:
- **Configuration** — calls its own independent `useAgentHub()` instance and renders the FULL UI: status banner, proposals list, full rules editor (base-action selectors + custom rule builder + editable rule list), activity feed with filter chips, footer (Pause/Resume). This is effectively today's full `AgentPanel.tsx` JSX, un-gated and laid out statically instead of as a dialog.
- **Local Setup Documentation** — placeholder scaffold, icon `BookOpen`/`FileText`, "Setup documentation coming soon" plus a few labeled sub-headings (Prerequisites / Environment variables / Running the agent locally) each "Coming soon", ready for real content later without restructuring.
- **Download skill.md** — new utility `frontend/src/utils/skillFile.ts` (matches existing `frontend/src/utils/jobFingerprint.ts` convention) exporting `buildSkillMarkdown()`, returning a template string with YAML frontmatter (`name`, `description`) and TODO-marked body sections (Setup / Available actions / Notes). Button wired via the same Blob + `URL.createObjectURL` + temporary `<a download>` pattern already used for CSV export in [Tracker.tsx](frontend/src/pages/Tracker.tsx) (~lines 190-217), downloading as `searchtern-agent-skill.md`.

**3. Settings.tsx — no change needed**
[Settings.tsx](frontend/src/pages/Settings.tsx)'s "Show Agent hub in the tracker" toggle (`showTrackerTab`) stays exactly as-is — it still has a real purpose gating the (now-minimal) drawer's visibility in Tracker. "Allow agents to act on my account" also stays untouched.

**4. CSS**
[AgentPanel.css](frontend/src/styles/AgentPanel.css) keeps its drawer-shell rules (fixed positioning, slide transform, close button, z-index) since `AgentPanel.tsx` remains a real drawer. Content classes it already defines (`.agent-item`, `.agent-status-pill`, rule/activity row styles, etc.) are reused as-is by the new Configuration section in `AgentHub.tsx` — that section just wraps them in a static `.settings-section` container instead of the fixed-position drawer shell, so no positioning rules leak into the page. New rules for the Docs/skill.md sections follow the `.settings-section` conventions already defined in `frontend/src/styles/Settings.css`.

**5. Untouched (confirm, don't edit)**
`frontend/src/components/AgentOverlay.tsx`, `frontend/src/styles/AgentOverlay.css`, `frontend/src/App.tsx`'s global FAB mount, `backend/api.py`, `backend/read_db.py`, `frontend/src/api/agent.ts` — no changes needed anywhere here.

## Verification

1. Run the frontend dev server; open the Tracker page, toggle the "Agent hub" drawer, and confirm it now shows only: connection status, pending proposals (with working Approve/Reject/Always/Never), and a read-only rules summary — no rule builder, no activity feed.
2. From the drawer, click "Manage rules & activity → Agent Hub" and confirm it navigates to `/agent-hub`.
3. Navigate via the new "Agent Hub" nav link to `/agent-hub`; confirm the Configuration section shows the FULL feature set: proposals, connection status, full rule editor (base action + custom builder + delete), and activity feed with filter chips — all functioning identically to the old full drawer.
4. Confirm both the drawer and the dedicated tab pull consistent, live data (e.g., approve a proposal in the drawer, then open the dedicated tab and confirm it reflects the update after its own refresh).
5. Confirm `/settings`'s "Show Agent hub in the tracker" and "Allow agents to act on my account" toggles still work exactly as before.
6. Confirm the Docs section renders its "coming soon" placeholders with normal `.settings-section` styling.
7. Click "Download skill.md"; open the downloaded file and confirm valid `---`-delimited YAML frontmatter (`name:`, `description:`) followed by the TODO body.
8. Confirm the floating Agent FAB (`AgentOverlay.tsx`, bottom corner) still works unchanged on any page.
9. Run the frontend TypeScript build/lint to catch unused imports or dead code from the `AgentPanel.tsx` trim.
