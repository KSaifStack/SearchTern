import type { JobStatus } from "../components/TrackerContext";

const api_key = import.meta.env.VITE_API_KEY;
const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

let cachedSessionToken: string | null = null;

/** Keep the signed-in session token so agent-management calls can be authenticated server-side. */
export function setAgentSessionToken(token: string | null) {
    cachedSessionToken = token;
}

function sessionHeaders(): Record<string, string> {
    return cachedSessionToken ? { "X-Supabase-Token": cachedSessionToken } : {};
}

export type AgentTool = "add_to_tracker" | "update_status" | "apply";
export type AgentDecision = "approved" | "rejected" | "cancelled";

export interface AgentProposal {
    id: number;
    user_id: string;
    tool: AgentTool;
    payload: {
        company: string;
        role: string;
        location?: string;
        link?: string;
        status?: JobStatus;
    };
    status: "pending" | "approved" | "rejected" | "cancelled";
    note?: string | null;
    created_at: string;
    decided_at?: string | null;
}

export async function fetchPendingAgentProposals(userId: string): Promise<AgentProposal[]> {
    try {
        const res = await fetch(
            `${BASE_URL}/agent/proposals?user_id=${encodeURIComponent(userId)}&status=pending`,
            { headers: { ...sessionHeaders(), ...(api_key ? { "X-API-Key": api_key } : {}) } }
        );
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data?.result) ? data.result : [];
    } catch {
        return [];
    }
}

export async function decideAgentProposal(
    proposalId: number,
    decision: AgentDecision,
    userId: string
): Promise<boolean> {
    try {
        const res = await fetch(`${BASE_URL}/agent/proposals/${proposalId}/decision`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...sessionHeaders(),
                ...(api_key ? { "X-API-Key": api_key } : {}),
            },
            body: JSON.stringify({ decision, user_id: userId }),
        });
        return res.ok;
    } catch {
        return false;
    }
}

// ── Per-user agent keys & settings (Settings page) ───────────────────────────

export interface AgentKey {
    id: number;
    name: string;
    key_prefix: string;
    active: boolean;
    created_at: string;
    last_used_at: string | null;
}

function appHeaders(extra?: Record<string, string>): Record<string, string> {
    return {
        "Content-Type": "application/json",
        ...sessionHeaders(),
        ...(api_key ? { "X-API-Key": api_key } : {}),
        ...extra,
    };
}

export async function fetchAgentKeys(userId: string): Promise<AgentKey[]> {
    try {
        const res = await fetch(
            `${BASE_URL}/agent/keys?user_id=${encodeURIComponent(userId)}`,
            { headers: appHeaders() }
        );
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data?.result) ? data.result : [];
    } catch {
        return [];
    }
}

export interface CreatedAgentKey {
    id: number;
    name: string;
    key: string;
    key_prefix: string;
}

export async function createAgentKey(userId: string, name: string): Promise<CreatedAgentKey | null> {
    try {
        const res = await fetch(`${BASE_URL}/agent/keys`, {
            method: "POST",
            headers: appHeaders(),
            body: JSON.stringify({ user_id: userId, name }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data?.result ?? null;
    } catch {
        return null;
    }
}

export async function revokeAgentKey(userId: string, keyId: number): Promise<boolean> {
    try {
        const res = await fetch(`${BASE_URL}/agent/keys/${keyId}/revoke`, {
            method: "POST",
            headers: appHeaders(),
            body: JSON.stringify({ user_id: userId }),
        });
        return res.ok;
    } catch {
        return false;
    }
}

export interface AgentSettings {
    enabled: boolean;
    showTrackerTab: boolean;
}

export async function fetchAgentSettings(userId: string): Promise<AgentSettings | null> {
    try {
        const res = await fetch(
            `${BASE_URL}/agent/settings?user_id=${encodeURIComponent(userId)}`,
            { headers: appHeaders() }
        );
        if (!res.ok) return null;
        const data = await res.json();
        return {
            enabled: Boolean(data?.enabled),
            showTrackerTab: Boolean(data?.show_tracker_tab),
        };
    } catch {
        return null;
    }
}

export async function setAgentSettings(
    userId: string,
    patch: Partial<AgentSettings>
): Promise<AgentSettings | null> {
    try {
        const res = await fetch(`${BASE_URL}/agent/settings`, {
            method: "POST",
            headers: appHeaders(),
            body: JSON.stringify({ user_id: userId, ...patch }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        return {
            enabled: Boolean(data?.enabled),
            showTrackerTab: Boolean(data?.show_tracker_tab),
        };
    } catch {
        return null;
    }
}

// ── Agent policies ───────────────────────────────────────────────────────────

export type AgentPolicyAction = "allow" | "ask" | "block";

export interface AgentPolicy {
    id: number;
    tool: AgentTool;
    action: AgentPolicyAction;
    match: Record<string, string>;
}

export async function fetchAgentPolicies(userId: string): Promise<AgentPolicy[]> {
    try {
        const res = await fetch(
            `${BASE_URL}/agent/policies?user_id=${encodeURIComponent(userId)}`,
            { headers: appHeaders() }
        );
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data?.result) ? data.result : [];
    } catch {
        return [];
    }
}

export async function saveAgentPolicy(
    userId: string,
    tool: AgentTool,
    action: AgentPolicyAction,
    match: Record<string, string> = {}
): Promise<AgentPolicy | null> {
    try {
        const res = await fetch(`${BASE_URL}/agent/policies`, {
            method: "POST",
            headers: appHeaders(),
            body: JSON.stringify({ user_id: userId, tool, action, match }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data?.result ?? null;
    } catch {
        return null;
    }
}

export async function deleteAgentPolicy(userId: string, policyId: number): Promise<boolean> {
    try {
        const res = await fetch(`${BASE_URL}/agent/policies/${policyId}`, {
            method: "DELETE",
            headers: appHeaders(),
            body: JSON.stringify({ user_id: userId }),
        });
        return res.ok;
    } catch {
        return false;
    }
}

export async function fetchAgentActivity(userId: string): Promise<AgentProposal[]> {
    try {
        const res = await fetch(
            `${BASE_URL}/agent/proposals?user_id=${encodeURIComponent(userId)}`,
            { headers: appHeaders() }
        );
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data?.result) ? data.result : [];
    } catch {
        return [];
    }
}

// ── Agent health / liveness ─────────────────────────────────────────────

export type AgentConnectionStatus = "connected" | "disconnected" | "never";

export interface AgentHealth {
    user_id: string;
    status: AgentConnectionStatus;
    enabled: boolean;
    seconds_since_last_seen: number | null;
    last_seen_at: string | null;
    last_action: string | null;
    last_search_at: string | null;
    last_search_count: number | null;
}

export async function fetchAgentHealth(userId: string): Promise<AgentHealth | null> {
    try {
        const res = await fetch(
            `${BASE_URL}/agent/health?user_id=${encodeURIComponent(userId)}`,
            { headers: appHeaders() }
        );
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}