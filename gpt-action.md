# SearchTern — ChatGPT Action

Two blocks. Block 1 → the Actions panel "Schema" field. Block 2 → the
"Instructions" field. Then set Authentication → Bearer → the user's `st_` key.

---

## Block 1 — Schema (paste into Actions)

```yaml
openapi: 3.1.0
info:
  title: SearchTern
  description: >-
    Search a live board of internships and jobs, read the user's application
    tracker, and file proposals for the user to approve. Proposes never change
    the tracker directly.
  version: 1.0.0
servers:
  - url: https://api.searchtern.ksaif.dev

paths:
  /agent/search:
    get:
      operationId: searchInternships
      summary: Search live internships and jobs
      description: >-
        Search the public job board by role keyword and/or location. Returns
        currently open postings. Use this when the user asks to find
        internships or jobs.
      parameters:
        - name: q
          in: query
          required: false
          description: Role or skill keyword, e.g. "software engineer", "data".
          schema:
            type: string
        - name: location
          in: query
          required: false
          description: Location substring, e.g. "Remote", "New York".
          schema:
            type: string
        - name: limit
          in: query
          required: false
          description: Max results to return. Keep small to stay readable.
          schema:
            type: integer
            minimum: 1
            maximum: 25
            default: 10
      responses:
        "200":
          description: Matching postings.
          content:
            application/json:
              schema:
                type: object
                properties:
                  count:
                    type: integer
                    description: Number of results in this response.
                  total:
                    type: integer
                    description: Total matches before the limit was applied.
                  result:
                    type: array
                    items:
                      $ref: "#/components/schemas/Posting"
        "401":
          description: Missing or invalid agent key.

  /agent/tracker:
    get:
      operationId: getApplicationTracker
      summary: Read the user's application tracker
      description: >-
        Return the user's saved jobs and their current status, most recently
        added first. Use this when the user asks what they are tracking or
        where an application stands.
      responses:
        "200":
          description: The user's tracked jobs.
          content:
            application/json:
              schema:
                type: object
                properties:
                  jobs:
                    type: array
                    items:
                      $ref: "#/components/schemas/TrackedJob"
                  note:
                    type: string
                    description: Present only if the tracker could not be read.
        "401":
          description: Missing or invalid agent key.

  /agent/health:
    get:
      operationId: getAgentStatus
      summary: Check whether agent actions are enabled
      description: >-
        Return connection status and whether the user has agent actions
        enabled. If enabled is false, do not call proposeTrackerAction.
      responses:
        "200":
          description: Agent status for this account.
          content:
            application/json:
              schema:
                type: object
                properties:
                  status:
                    type: string
                    enum: [connected, disconnected, never]
                  enabled:
                    type: boolean
                    description: Whether this user permits agent actions.
                  last_action:
                    type: [string, "null"]
                  last_seen_at:
                    type: [string, "null"]

  /agent/propose:
    post:
      operationId: proposeTrackerAction
      summary: Propose a tracker change for the user to approve
      description: >-
        File a proposed change to the user's tracker. This NEVER changes the
        tracker by itself. The user reviews and approves it in SearchTern.
        Returns the resulting status, which is "approved" only if the user
        pre-authorized this tool type with an "allow" policy, and "pending"
        otherwise. Report the real status back to the user.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [tool, payload]
              properties:
                tool:
                  type: string
                  enum: [add_to_tracker, update_status]
                  description: >-
                    add_to_tracker saves a new job. update_status moves an
                    existing job to a new status.
                payload:
                  type: object
                  required: [company, role]
                  description: The job details. company and role are required.
                  properties:
                    company:
                      type: string
                    role:
                      type: string
                    location:
                      type: string
                    link:
                      type: string
                      description: URL of the posting.
                    status:
                      type: string
                      enum: [Saved, Applied, Interview, Offer, Rejected]
                      description: Required for update_status.
                    notes:
                      type: string
                note:
                  type: string
                  description: Short human-readable reason, shown in the review UI.
      responses:
        "200":
          description: The proposal was recorded.
          content:
            application/json:
              schema:
                type: object
                properties:
                  proposal_id:
                    type: integer
                  status:
                    type: string
                    enum: [approved, pending]
                  tool:
                    type: string
                  policy:
                    type: string
                    enum: [allow, ask, block]
        "400":
          description: Missing company or role, or an invalid status.
        "401":
          description: Missing or invalid agent key.
        "403":
          description: >-
            Agent actions are disabled for this account, or the user's policy
            blocks this tool. Do not retry.

components:
  schemas:
    Posting:
      type: object
      properties:
        id:
          type: integer
        company:
          type: string
        role:
          type: string
        location:
          type: string
        link:
          type: string
          description: URL of the posting. Always show this to the user.
        type:
          type: [string, "null"]
          description: Internship, new grad, or general role.
        season:
          type: [string, "null"]
        date:
          type: [string, "null"]
          description: Posting date as recorded on the board.
    TrackedJob:
      type: object
      properties:
        company:
          type: string
        role:
          type: string
        location:
          type: string
        link:
          type: [string, "null"]
        status:
          type: string
          enum: [Saved, Applied, Interview, Offer, Rejected]
        date_added:
          type: [string, "null"]
        date_applied:
          type: [string, "null"]
        notes:
          type: [string, "null"]
```

---

## Block 2 — Instructions (paste into Instructions)

```
You are connected to SearchTern, the user's job and internship tracker.

Behave like an assistant, not a database. Summarize results in plain language
and link out to postings. Do not paste raw JSON at the user.

SAFETY — read before acting:

- You CANNOT submit job applications. You have no browser and no ability to
  fill forms. If asked to apply, say so plainly and offer to save the job to the
  tracker instead. Never claim an application was submitted.
- proposeTrackerAction does not change anything by itself. It records a request
  the user approves in SearchTern. Always tell the user a proposal is waiting
  for them, and quote the returned status honestly:
    - "pending"  -> waiting for the user to approve
    - "approved" -> their policy pre-authorized it and it is already applied
- On a 403, do not retry. The user disabled agent actions or blocked that tool.
  Explain what happened and stop.
- On a 401, the connection is not set up correctly. Ask the user to re-check the
  API key in their action configuration. Do not retry.

READ BEFORE PROPOSING:

Call getApplicationTracker first to check whether a job is already saved, so you
do not create duplicates. To move a job's status you need its company and role
exactly as they appear in the tracker.

When you save a job, always include the posting link from the search result.
```

---

## Setup

| Step | Value |
|---|---|
| Authentication | API key → **Bearer** |
| API key | the user's `st_...` key from SearchTern → Settings → AI Agents |
| Endpoints | the four above |

## Deliberately excluded

| Endpoint | Why not |
|---|---|
| `/agent/resume` | Returns resume bytes as base64 (`api.py:528`). PII into OpenAI logs. |
| `/agent/artifacts` | Upload endpoint. No use from a chatbot. |
| `/agent/proposals/*` | Approve/reject — needs the app key, not the agent key. |
| `/agent/settings`, `/agent/policies` | Admin surfaces. |
| `/update` and all public routes | Unrelated to the agent contract. |

## Per-user setup

The API key is per-user, so each person configures their own GPT with their own
`st_` key. There is no shared-credential install — by design.

## Known limits

- Anthropic aside: this works in ChatGPT only. Claude needs remote MCP, which is
  a separate piece of work.
- The apply companion (Playwright, real form filling) is local-only and can
  never run in a hosted chatbot.
