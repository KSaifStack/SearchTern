import { useCallback, useEffect, useState } from "react";
import { notifications } from "@mantine/notifications";
import { useNavigate } from "react-router-dom";
import {
    Robot,
    Check,
    X,
    Trash,
    Plus,
    BookmarkSimple,
    PaperPlaneTilt,
    ArrowClockwise,
    GearSix,
    Pause,
    Play,
} from "@phosphor-icons/react";
import { useAuth } from "./AuthContext";
import { useTracker } from "./TrackerContext";
import { makeJobFingerprint } from "../utils/jobFingerprint";
import {
    fetchPendingAgentProposals,
    decideAgentProposal,
    fetchAgentPolicies,
    saveAgentPolicy,
    deleteAgentPolicy,
    fetchAgentActivity,
    fetchAgentHealth,
    fetchAgentKeys,
    setAgentSettings,
    type AgentProposal,
    type AgentPolicy,
    type AgentTool,
    type AgentPolicyAction,
    type AgentHealth,
    type AgentKey,
} from "../api/agent";
import "../styles/AgentPanel.css";

const TOOLS: AgentTool[] = ["add_to_tracker", "update_status", "apply"];

const TOOL_META: Record<AgentTool, { title: string; icon: React.ReactNode }> = {
    add_to_tracker: { title: "Save to tracker", icon: <BookmarkSimple size={16} weight="bold" /> },
    update_status: { title: "Update status", icon: <ArrowClockwise size={16} weight="bold" /> },
    apply: { title: "Apply for internship", icon: <PaperPlaneTilt size={16} weight="bold" /> },
};

function describe(p: AgentProposal): string {
    const { company, role, location, status } = p.payload;
    switch (p.tool) {
        case "add_to_tracker":
            return `Save ${role} at ${company}${location ? ` (${location})` : ""} to your Saved column.`;
        case "update_status":
            return `Move ${role} at ${company}${location ? ` (${location})` : ""} to "${status}".`;
        case "apply":
            return `Apply for ${role} at ${company}${location ? ` (${location})` : ""} — will be recorded as Applied in your tracker.`;
    }
}

function matchLabel(tool: AgentTool, match: Record<string, string>): string {
    const toolName = TOOL_META[tool].title;
    if (!match || Object.keys(match).length === 0) return `Every ${toolName}`;
    const parts = Object.entries(match).map(([k, v]) => {
        switch (k) {
            case "location_contains": return `location contains "${v}"`;
            case "role_contains": return `role contains "${v}"`;
            case "company_eq": return `company is "${v}"`;
            default: return `${k}="${v}"`;
        }
    });
    return `${toolName} when ${parts.join(" and ")}`;
}

const ACTION_NAMES: Record<AgentPolicyAction, string> = {
    allow: "Auto",
    ask: "Ask",
    block: "Block",
};

function timeAgo(iso: string): string {
    const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
    if (seconds < 60) return "just now";
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}

function agoFromSeconds(seconds: number): string {
    if (seconds < 45) return "just now";
    if (seconds < 60) return "under a minute ago";
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}

type StatusFilter = "all" | "pending" | "approved" | "rejected";

type StatusState = "pending" | "searching" | "connected" | "disconnected" | "never" | "configured" | "paused" | "checking";

const CONN_WORD: Record<StatusState, string> = {
    pending: "Action needed",
    searching: "Searching",
    connected: "Connected",
    disconnected: "Disconnected",
    never: "Not connected",
    configured: "Standing by",
    paused: "Paused",
    checking: "Checking",
};

export function AgentPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
    const { user } = useAuth();
    const { addJob, updateJobStatus, isJobTracked } = useTracker();
    const navigate = useNavigate();
    const userId = user?.id ?? "";

    const [ready, setReady] = useState(false);
    const [pending, setPending] = useState<AgentProposal[]>([]);
    const [policies, setPolicies] = useState<AgentPolicy[]>([]);
    const [activity, setActivity] = useState<AgentProposal[]>([]);
    const [health, setHealth] = useState<AgentHealth | null>(null);
    const [keys, setKeys] = useState<AgentKey[]>([]);
    const [busyIds, setBusyIds] = useState<Set<number>>(new Set());
    const [saving, setSaving] = useState<boolean>(false);

    const [ruleTool, setRuleTool] = useState<AgentTool>("apply");
    const [ruleField, setRuleField] = useState<"location_contains" | "role_contains" | "company_eq">("location_contains");
    const [ruleValue, setRuleValue] = useState("");
    const [ruleAction, setRuleAction] = useState<"allow" | "block">("allow");
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

    const refreshPending = useCallback(async () => {
        setPending(await fetchPendingAgentProposals(userId));
    }, [userId]);

    const refreshHealth = useCallback(async () => {
        setHealth(await fetchAgentHealth(userId));
    }, [userId]);

    const refreshAll = useCallback(async () => {
        const [pList, pol, act, h, k] = await Promise.all([
            fetchPendingAgentProposals(userId),
            fetchAgentPolicies(userId),
            fetchAgentActivity(userId),
            fetchAgentHealth(userId),
            fetchAgentKeys(userId),
        ]);
        setPending(pList);
        setPolicies(pol);
        setActivity(act.slice(0, 50));
        setHealth(h);
        setKeys(k);
        setReady(true);
    }, [userId]);

    // Load once on mount, and refresh each time the drawer is opened.
    useEffect(() => { void refreshAll(); }, [refreshAll]);
    useEffect(() => { if (open) void refreshAll(); }, [open, refreshAll]);

    // Poll pending + health while the drawer is open.
    useEffect(() => {
        if (!open) return;
        const id = window.setInterval(() => {
            void refreshPending();
            void refreshHealth();
        }, 8000);
        return () => window.clearInterval(id);
    }, [open, refreshPending, refreshHealth]);

    // ESC to close + lock body scroll while the drawer is open.
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            window.removeEventListener("keydown", onKey);
            document.body.style.overflow = prev;
        };
    }, [open, onClose]);

    const togglePaused = useCallback(async () => {
        if (!health) return;
        const saved = await setAgentSettings(userId, { enabled: !health.enabled });
        if (saved) setHealth(await fetchAgentHealth(userId));
    }, [health, userId]);

    const settle = useCallback(
        async (p: AgentProposal, decision: "approved" | "rejected", remember?: "allow" | "block") => {
            if (busyIds.has(p.id)) return;
            setBusyIds((prev) => new Set(prev).add(p.id));
            setSaving(true);

            if (remember) {
                await saveAgentPolicy(userId, p.tool, remember, {});
            }
            if (decision === "approved") {
                const { company, role, location, link, status } = p.payload;
                const loc = location ?? "";
                if (p.tool === "add_to_tracker") {
                    addJob({ company, role, location: loc, link }, "Saved");
                } else if (p.tool === "apply") {
                    if (isJobTracked(company, role, loc)) {
                        updateJobStatus(makeJobFingerprint(company, role, loc), "Applied");
                    } else {
                        addJob({ company, role, location: loc, link }, "Applied");
                    }
                } else if (p.tool === "update_status") {
                    updateJobStatus(makeJobFingerprint(company, role, loc), status as NonNullable<typeof status>);
                }
            }

            await decideAgentProposal(p.id, decision, userId);
            if (remember) {
                notifications.show({
                    title: remember === "allow" ? "Rule saved — always allow" : "Rule saved — never again",
                    message: `${TOOL_META[p.tool].title.toLowerCase()} ${
                        remember === "allow" ? "will be auto-approved" : "will be blocked"
                    } from now on. Change it anytime in Agent hub → Rules.`,
                    color: remember === "allow" ? "teal" : "red",
                    autoClose: 3500,
                });
            }
            setBusyIds((prev) => {
                const next = new Set(prev);
                next.delete(p.id);
                return next;
            });
            setSaving(false);
            await refreshAll();
        },
        [busyIds, userId, addJob, updateJobStatus, isJobTracked, refreshAll]
    );

    const setBaseAction = useCallback(
        async (tool: AgentTool, action: AgentPolicyAction) => {
            if (saving) return;
            setSaving(true);
            await saveAgentPolicy(userId, tool, action, {});
            setPolicies(await fetchAgentPolicies(userId));
            setSaving(false);
        },
        [userId, saving]
    );

    const addRule = useCallback(async () => {
        const value = ruleValue.trim();
        if (!value || saving) return;
        setSaving(true);
        await saveAgentPolicy(userId, ruleTool, ruleAction, { [ruleField]: value.toLowerCase() });
        setRuleValue("");
        setPolicies(await fetchAgentPolicies(userId));
        setSaving(false);
    }, [ruleValue, ruleTool, ruleField, ruleAction, saving, userId]);

    const removePolicy = useCallback(
        async (id: number) => {
            setSaving(true);
            await deleteAgentPolicy(userId, id);
            setPolicies(await fetchAgentPolicies(userId));
            setSaving(false);
        },
        [userId]
    );

    // Single source of truth for the running state — never two conflicting badges.
    const lastSeen = activity.length > 0 ? activity[0] : null;
    let status: StatusState = "checking";
    let statusLabel: React.ReactNode = "Checking agent connection…";
    let connTip = "Checking the agent connection…";
    if (health) {
        if (!health.enabled) {
            status = "paused";
            statusLabel = <><strong>Agent is paused</strong> — actions are disabled. Use Resume below to re-enable.</>;
            connTip = "Agent actions are currently paused";
        } else if (pending.length > 0) {
            status = "pending";
            statusLabel = (
                <>
                    <strong>{pending.length}</strong> action{pending.length > 1 ? "s" : ""} awaiting your approval.
                    {lastSeen && <span className="agent-hub-status-foot"> last seen {timeAgo(lastSeen.created_at)}</span>}
                </>
            );
            connTip = "Actions are waiting for your approval";
        } else if (health.status === "never" && keys.length === 0) {
            status = "never";
            statusLabel = <><strong>Not connected yet</strong> — generate an agent key in Settings → AI Agents and use it with Claude Code / opencode.</>;
            connTip = "No agent key has been created yet";
        } else if (health.status === "never") {
            status = "configured";
            statusLabel = <><strong>Agent never connected</strong> — your key is ready, run your agent with it to begin.</>;
            connTip = "A key exists but the agent hasn't run yet";
        } else if (health.status === "connected" && health.last_action === "search") {
            status = "searching";
            statusLabel = <><strong>Scanning {health.last_search_count?.toLocaleString() ?? "…"} listings</strong> for matches…</>;
            connTip = "The agent is actively searching listings";
        } else if (health.status === "connected") {
            status = "connected";
            statusLabel = <><strong>Agent connected</strong> — actively working. Nothing needs you right now.</>;
            connTip = "The agent is connected and working";
        } else {
            status = "disconnected";
            statusLabel = <><strong>Agent disconnected</strong> — last seen {health.seconds_since_last_seen != null ? agoFromSeconds(health.seconds_since_last_seen) : "recently"}. It reconnects whenever you run it again.</>;
            connTip = "The agent was active earlier but has gone quiet";
        }
    }
    const baseActionFor = (tool: AgentTool): AgentPolicyAction => {
        const base = policies.find(p => p.tool === tool && Object.keys(p.match).length === 0);
        return base?.action ?? "ask";
    };
    const specific = policies.filter(p => Object.keys(p.match).length > 0);
    const filteredActivity = statusFilter === "all"
        ? activity
        : activity.filter(p => p.status === statusFilter);
    const countBy = (s: StatusFilter) => s === "all" ? activity.length : activity.filter(p => p.status === s).length;

    return (
        <>
            <div
                className={`agent-hub-backdrop${open ? " agent-hub-backdrop-open" : ""}`}
                onClick={onClose}
                aria-hidden="true"
            />
            <aside
                className={`agent-hub${open ? " agent-hub-open" : ""}`}
                role="dialog"
                aria-modal={open}
                aria-label="Agent hub"
            >
                <header className="agent-hub-header">
                    <span className="agent-hub-title"><Robot size={20} weight="bold" /> Agent hub</span>
                    <div className="agent-hub-header-right">
                        <span className={`agent-hub-chip agent-hub-chip-${status}`} title={connTip}>
                            <span className="agent-hub-chip-dot" />
                            {CONN_WORD[status]}
                        </span>
                        <button className="agent-hub-close" onClick={onClose} aria-label="Close agent hub" title="Close (Esc)">
                            <X size={18} weight="bold" />
                        </button>
                    </div>
                </header>

                <div className="agent-hub-body">
                    {!ready ? (
                        <p className="agent-hub-empty">Loading agent activity…</p>
                    ) : (
                        <>
                            <div className={`agent-hub-status agent-hub-status-${status}`}>
                                <span className="agent-hub-dot" />
                                <span className="agent-hub-status-label">{statusLabel}</span>
                            </div>

                            <div className="agent-hub-section">
                                <span className="agent-hub-section-title">Proposes</span>
                                {pending.length === 0 ? (
                                    <p className="agent-hub-empty">Nothing waiting. When your agent proposes an action it lands here.</p>
                                ) : (
                                    <div className="agent-list">
                                        {pending.map((p) => {
                                            const busy = busyIds.has(p.id);
                                            const meta = TOOL_META[p.tool] ?? { title: p.tool };
                                            return (
                                                <div className="agent-item" key={p.id}>
                                                    <div className="agent-item-icon">{meta.icon}</div>
                                                    <div className="agent-item-body">
                                                        <span className="agent-item-title">{meta.title}</span>
                                                        <span className="agent-item-desc">{describe(p)}</span>
                                                        {p.payload.link && (
                                                            <a href={p.payload.link} target="_blank" rel="noreferrer" className="agent-item-link">
                                                                {p.payload.company} listing ↗
                                                            </a>
                                                        )}
                                                        {p.note && <span className="agent-item-note">"{p.note}"</span>}
                                                    </div>
                                                    <div className="agent-item-actions agent-item-actions-wide">
                                                        <button
                                                            className="agent-remember agent-remember-allow"
                                                            disabled={busy || saving}
                                                            onClick={() => settle(p, "approved", "allow")}
                                                            title="Approve and always allow this action from now on"
                                                        >
                                                            <Check size={16} weight="bold" /> Always
                                                        </button>
                                                        <button
                                                            className="agent-approve"
                                                            disabled={busy || saving}
                                                            onClick={() => settle(p, "approved")}
                                                            title="Approve — the action is applied to your tracker"
                                                        >
                                                            <Check size={18} weight="bold" />
                                                        </button>
                                                        <button
                                                            className="agent-reject"
                                                            disabled={busy || saving}
                                                            onClick={() => settle(p, "rejected")}
                                                            title="Reject — nothing happens"
                                                        >
                                                            <X size={18} weight="bold" />
                                                        </button>
                                                        <button
                                                            className="agent-remember agent-remember-block"
                                                            disabled={busy || saving}
                                                            onClick={() => settle(p, "rejected", "block")}
                                                            title="Reject and block this action from ever happening"
                                                        >
                                                            <X size={16} weight="bold" /> Never
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            <div className="agent-hub-section">
                                <span className="agent-hub-section-title">Rules</span>
                                <div className="agent-rules">
                                    {TOOLS.map((tool) => {
                                        const action = baseActionFor(tool);
                                        const meta = TOOL_META[tool];
                                        return (
                                            <div className="agent-rule-row" key={tool}>
                                                <span className="agent-rule-name">{meta.icon} {meta.title}</span>
                                                <div className="agent-segmented">
                                                    {(["ask", "allow", "block"] as AgentPolicyAction[]).map((a) => (
                                                        <button
                                                            key={a}
                                                            className={`agent-seg-option${action === a ? ` agent-seg-${a}` : ""}`}
                                                            disabled={saving}
                                                            onClick={() => setBaseAction(tool, a)}
                                                            title={a === "allow" ? "Auto-approve — no approval needed" : a === "block" ? "Block — never allowed" : "Ask — you approve every time"}
                                                        >
                                                            {ACTION_NAMES[a]}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="agent-rule-builder">
                                    <select className="agent-rule-input" value={ruleTool} onChange={(e) => setRuleTool(e.target.value as AgentTool)}>
                                        {TOOLS.map(t => <option key={t} value={t}>{TOOL_META[t].title}</option>)}
                                    </select>
                                    <select className="agent-rule-input" value={ruleField} onChange={(e) => setRuleField(e.target.value as typeof ruleField)}>
                                        <option value="location_contains">location contains</option>
                                        <option value="role_contains">role contains</option>
                                        <option value="company_eq">company is</option>
                                    </select>
                                    <input
                                        className="agent-rule-input"
                                        placeholder="e.g. remote"
                                        value={ruleValue}
                                        onChange={(e) => setRuleValue(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === "Enter") void addRule() }}
                                    />
                                    <select
                                        className="agent-rule-input agent-rule-action"
                                        value={ruleAction}
                                        onChange={(e) => setRuleAction(e.target.value as "allow" | "block")}
                                    >
                                        <option value="allow">auto-approve</option>
                                        <option value="block">block</option>
                                    </select>
                                    <button className="agent-rule-add" disabled={!ruleValue.trim() || saving} onClick={() => void addRule()}>
                                        <Plus size={16} weight="bold" /> Add rule
                                    </button>
                                </div>

                                {specific.length > 0 && (
                                    <div className="agent-rule-list">
                                        {specific.map((pol) => (
                                            <div className="agent-rule-item" key={pol.id}>
                                                <span className={`agent-status-pill agent-status-${pol.action}`}>{ACTION_NAMES[pol.action]}</span>
                                                <span className="agent-rule-item-label">{matchLabel(pol.tool, pol.match)}</span>
                                                <button className="agent-rule-delete" disabled={saving} onClick={() => void removePolicy(pol.id)} title="Delete rule">
                                                    <Trash size={15} weight="bold" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="agent-hub-section">
                                <span className="agent-hub-section-title">Recent activity</span>
                                <div className="agent-filter-chips">
                                    {(["all", "pending", "approved", "rejected"] as StatusFilter[]).map((s) => (
                                        <button
                                            key={s}
                                            className={`agent-filter-chip${statusFilter === s ? ` agent-filter-chip-${s === "all" ? "all" : s}` : ""}`}
                                            onClick={() => setStatusFilter(s)}
                                        >
                                            {s}
                                            <span className="agent-filter-count">{countBy(s)}</span>
                                        </button>
                                    ))}
                                </div>
                                {filteredActivity.length === 0 ? (
                                    <p className="agent-hub-empty">No {statusFilter === "all" ? "" : `${statusFilter} `}activity yet.</p>
                                ) : (
                                    <div className="agent-activity-list">
                                        {filteredActivity.slice(0, 20).map((p) => (
                                            <div className="agent-activity-row" key={p.id}>
                                                <span className={`agent-status-pill agent-status-${p.status}`}>{p.status}</span>
                                                <span className="agent-activity-desc">{describe(p)}</span>
                                                <span className="agent-activity-date">
                                                    {new Date(p.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>

                <footer className="agent-hub-footer">
                    <button className="agent-hub-footer-action" onClick={() => navigate("/settings")}>
                        <GearSix size={16} weight="bold" /> Agent settings
                    </button>
                    <button
                        className="agent-hub-footer-action"
                        onClick={() => void togglePaused()}
                        disabled={!health}
                        title={health?.enabled ? "Pause the agent — nothing it proposes will be approved" : "Resume the agent"}
                    >
                        {health?.enabled ? <Pause size={16} weight="bold" /> : <Play size={16} weight="bold" />}
                        {health?.enabled ? "Pause" : "Resume"}
                    </button>
                </footer>
            </aside>
        </>
    );
}