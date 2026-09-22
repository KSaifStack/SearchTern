import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Switch } from "@mantine/core"
import { notifications } from "@mantine/notifications"
import {
    Trash,
    CheckCircle,
    WarningCircle,
    ArrowClockwise,
    DownloadSimple,
    SignIn,
    UserCircle,
    ShieldCheck,
    Robot,
    Key,
    Plus,
    Copy,
    X,
    SunDim,
    Moon,
    FileText,
    CaretDown,
} from "@phosphor-icons/react"
import { useAuth } from "../components/AuthContext"
import { useTheme } from "../components/ThemeContext"
import Resume from "./Resume"
import "../styles/Settings.css"
import {
    fetchAgentKeys,
    createAgentKey,
    revokeAgentKey,
    fetchAgentSettingsProbe,
    setAgentSettings,
    fetchAgentActivity,
    type AgentKey,
    type AgentProposal,
    type CreatedAgentKey,
} from "../api/agent"

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
    })
}

function describeActivity(p: AgentProposal): string {
    const { company, role, location } = p.payload
    switch (p.tool) {
        case "add_to_tracker":
            return `Save ${role} at ${company}${location ? ` (${location})` : ""}`
        case "update_status":
            return `Move ${role} at ${company} to ${p.payload.status}`
        case "apply":
            return `Apply for ${role} at ${company}${location ? ` (${location})` : ""}`
    }
}

function Settings() {
    const { user, signOut } = useAuth()
    const { theme, toggleTheme } = useTheme()

    const userId = user?.id ?? ""
    const [agentsAvailable, setAgentsAvailable] = useState<boolean | null>(null)
const [agentError, setAgentError] = useState<string | null>(null)
    const [agentEnabled, setAgentEnabled] = useState<boolean | null>(null)
    const [showTrackerTab, setShowTrackerTab] = useState(false)
    const [agentKeys, setAgentKeys] = useState<AgentKey[]>([])
    const [keyName, setKeyName] = useState("")
    const [creating, setCreating] = useState(false)
    const [createdKey, setCreatedKey] = useState<CreatedAgentKey | null>(null)
    const [activity, setActivity] = useState<AgentProposal[]>([])
    const [tab, setTab] = useState<"keys" | "activity" | "config">("keys")
    const [showRevoked, setShowRevoked] = useState(false)
    const [activityFilter, setActivityFilter] = useState<"all" | "approved" | "rejected">("all")
    const [visibleActivity, setVisibleActivity] = useState(10)
    const [resumeCount, setResumeCount] = useState(0)

    const displayName: string = user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? ''
    const displayEmail = user?.email ?? user?.user_metadata?.email ?? ''

    const loadAgentData = useCallback(async () => {
        if (!userId) {
            setAgentsAvailable(false)
            setAgentKeys([])
            setActivity([])
            return
        }
        const probe = await fetchAgentSettingsProbe(userId)
        if (probe.settings === null) {
            setAgentsAvailable(false)
            setAgentError(probe.status === null ? "network" : `HTTP ${probe.status}`)
            return
        }
        setAgentsAvailable(true)
        setAgentError(null)
        const { settings } = probe
        const [keys] = await Promise.all([
            fetchAgentKeys(userId),
        ])
        setAgentEnabled(settings.enabled)
        setShowTrackerTab(settings.showTrackerTab)
        setAgentKeys(keys)
        setActivity(await fetchAgentActivity(userId))
    }, [userId])

    useEffect(() => {
        void loadAgentData()
        const onFocus = () => void loadAgentData()
        window.addEventListener("focus", onFocus)
        return () => { window.removeEventListener("focus", onFocus) }
    }, [loadAgentData])

    const handleToggleAgents = useCallback(async (enabled: boolean) => {
        const prev = agentEnabled
        setAgentEnabled(enabled)
        const next = await setAgentSettings(userId, { enabled })
        if (next === null) {
            setAgentEnabled(prev)
            notifications.show({ title: 'Update failed', message: 'Could not update agent settings.', color: 'red', icon: <WarningCircle size={18} /> })
            return
        }
        const { enabled: nextEnabled } = next
        setAgentEnabled(nextEnabled)
        notifications.show({
            title: nextEnabled ? 'Agents enabled' : 'Agents disabled',
            message: nextEnabled ? 'Your agent can now propose actions for your approval.' : 'Agents can no longer propose actions.',
            color: nextEnabled ? 'teal' : 'blue',
            icon: <Robot size={18} weight="bold" />,
        })
    }, [userId, agentEnabled])

    const handleToggleTrackerTab = useCallback(async (show: boolean) => {
        const prev = showTrackerTab
        setShowTrackerTab(show)
        const next = await setAgentSettings(userId, { showTrackerTab: show })
        if (next === null) {
            setShowTrackerTab(prev)
            notifications.show({ title: 'Update failed', message: 'Could not update agent settings.', color: 'red', icon: <WarningCircle size={18} /> })
            return
        }
        setShowTrackerTab(next.showTrackerTab)
        if (next.showTrackerTab) {
            notifications.show({ title: 'Agent hub enabled', message: 'The Agent hub tab now appears at the top of the Application Tracker.', color: 'teal', icon: <Robot size={18} weight="bold" /> })
        }
    }, [userId, showTrackerTab])

    const handleCreateKey = useCallback(async () => {
        if (creating) return
        setCreating(true)
        const name = keyName.trim() || "agent"
        const created = await createAgentKey(userId, name)
        setCreating(false)
        if (!created) {
            notifications.show({ title: 'Key creation failed', message: 'Could not generate an agent key.', color: 'red', icon: <WarningCircle size={18} /> })
            return
        }
        setCreatedKey(created)
        setKeyName("")
        setAgentKeys(prev => [
            { id: created.id, name: created.name, key_prefix: created.key_prefix, active: true, created_at: new Date().toISOString(), last_used_at: null },
            ...prev,
        ])
    }, [creating, keyName, userId])

    const handleRevokeKey = useCallback(async (keyId: number) => {
        if (!window.confirm('Revoke this agent key? Agents using it will be disconnected immediately.')) return
        const ok = await revokeAgentKey(userId, keyId)
        if (!ok) {
            notifications.show({ title: 'Revoke failed', message: 'Could not revoke the key.', color: 'red', icon: <WarningCircle size={18} /> })
            return
        }
        setAgentKeys(prev => prev.filter(k => k.id !== keyId))
        notifications.show({ title: 'Key revoked', message: 'The agent key was revoked.', color: 'blue', icon: <CheckCircle size={18} /> })
    }, [userId])

    const copyKey = useCallback(async (text: string, label: string) => {
        navigator.clipboard.writeText(text).then(
            () => notifications.show({ title: 'Copied', message: label, color: 'teal', icon: <CheckCircle size={18} /> }),
            () => notifications.show({ title: 'Copy failed', message: 'Clipboard access was blocked by the browser.', color: 'red', icon: <WarningCircle size={18} /> }),
        )
    }, [])

    return (
        <div className="standard-layout">
            <div className="settings-header">
                <h2 className="settings-title">Settings</h2>
                <p className="settings-subtitle">Manage your account and your AI agents.</p>
            </div>

            {/* Account */}
            <section className="feature settings-section">
                <div className="settings-section-header">
                    <UserCircle size={24} weight="bold" className="settings-section-icon" />
                    <h3 className="settings-section-title">Account</h3>
                </div>
                {user ? (
                    <div className="settings-account">
                        <div className="settings-account-info">
                            {displayName && <span className="settings-account-name">{displayName}</span>}
                            <span className="settings-account-email">{displayEmail}</span>
                            <span className="settings-account-sync">
                                <ShieldCheck size={15} weight="fill" />
                                Resume sync enabled
                            </span>
                        </div>
                        <button
                            className="settings-btn settings-btn-ghost"
                            onClick={() => signOut()}
                        >
                            Log Out
                        </button>
                    </div>
                ) : (
                    <div className="settings-account settings-account-guest">
                        <span className="settings-account-email">
                            You are browsing as a guest. Your resume is stored only on this device.
                        </span>
                        <Link to="/auth" className="settings-btn settings-btn-primary">
                            <SignIn size={16} weight="bold" />
                            Log In to sync
                        </Link>
                    </div>
                )}
            </section>

            {/* Appearance */}
            <section className="feature settings-section">
                <div className="settings-section-header">
                    {theme === 'dark' ? <Moon size={24} weight="bold" className="settings-section-icon" /> : <SunDim size={24} weight="bold" className="settings-section-icon" />}
                    <h3 className="settings-section-title">Appearance</h3>
                </div>
                <div className="settings-agent-row">
                    <div className="settings-agent-info">
                        <span className="settings-agent-row-title">Dark mode</span>
                        <span className="settings-agent-row-desc">
                            Use the dark theme.
                        </span>
                    </div>
                    <Switch
                        checked={theme === 'dark'}
                        onChange={(e) => { if (theme === 'dark' !== e.currentTarget.checked) toggleTheme() }}
                        size="lg"
                        color="brand"
                    />
                </div>
            </section>

            {/* Resumes */}
            <section className="feature settings-section">
                <div className="settings-section-header">
                    <FileText size={24} weight="bold" className="settings-section-icon" />
                    <h3 className="settings-section-title">Resumes</h3>
                </div>
                <Resume onCountChange={setResumeCount} />
                {resumeCount > 1 && (
                    <p className="resume-agent-note">
                        <Robot size={15} weight="bold" />
                        Your AI agent uses whichever resume is marked active (filled circle). Set the checkmark on the resume you want sent with applications.
                    </p>
                )}
            </section>

            {/* AI Agents */}
            <section className="feature settings-section">
                <div className="settings-section-header">
                    <Robot size={24} weight="bold" className="settings-section-icon" />
                    <h3 className="settings-section-title">AI Agents</h3>
                </div>

                {!user ? (
                    <div className="settings-agent-unavailable">
                        <p className="settings-muted">
                            Login/sign in to use AI Agents
                        </p>
                    </div>
                ) : agentsAvailable === null ? (
                    <p className="settings-muted">
                        Loading agent settings…
                    </p>
                ) : !agentsAvailable ? (
                    <div className="settings-agent-unavailable">
                        <WarningCircle size={20} weight="bold" className="settings-agent-unavailable-icon" />
                        <p className="settings-muted">Backend error ({agentError ?? "unknown"}). Please try again.</p>
                        <button className="settings-btn settings-btn-secondary" onClick={() => void loadAgentData()} disabled={!loadAgentData}>
                            <ArrowClockwise size={16} weight="bold" />
                            Retry
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="settings-agent-tabs" role="tablist">
                            {(["keys", "activity", "config"] as const).map(t => (
                                <button
                                    key={t}
                                    className={`settings-agent-tab${tab === t ? " active" : ""}`}
                                    onClick={() => setTab(t)}
                                    role="tab"
                                    aria-selected={tab === t}
                                >
                                    {t.charAt(0).toUpperCase() + t.slice(1)}
                                </button>
                            ))}
                        </div>

                        {tab === "keys" && (
                            <>
                                <div className="settings-agent-create">
                                    <input
                                        className="settings-key-input"
                                        placeholder="Key name, e.g. Claude Code laptop"
                                        value={keyName}
                                        onChange={(e) => setKeyName(e.target.value)}
                                        maxLength={60}
                                        onKeyDown={(e) => { if (e.key === 'Enter') void handleCreateKey() }}
                                    />
                                    <button className="settings-btn settings-btn-primary" onClick={() => void handleCreateKey()} disabled={creating}>
                                        <Plus size={16} weight="bold" />
                                        {creating ? 'Generating…' : 'Generate key'}
                                    </button>
                                </div>

                                {createdKey && (
                                    <div className="settings-key-callout">
                                        <Key size={18} weight="bold" className="settings-key-callout-icon" />
                                        <div className="settings-key-callout-body">
                                            <span className="settings-key-callout-title">Your new agent key: copy it now</span>
                                            <code className="settings-key-raw">{createdKey.key}</code>
                                            <span className="settings-key-callout-warn">
                                                This is the only time the full key is shown. Store it somewhere safe.
                                            </span>
                                        </div>
                                        <div className="settings-key-callout-actions">
                                            <button className="settings-btn settings-btn-secondary" onClick={() => copyKey(createdKey.key, 'Agent key copied to clipboard.')}>
                                                <Copy size={16} weight="bold" /> Copy
                                            </button>
                                            <button className="settings-btn settings-btn-ghost" onClick={() => setCreatedKey(null)} title="Dismiss">
                                                <X size={16} weight="bold" />
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {agentKeys.length === 0 ? (
                                    <p className="settings-muted">No keys yet — generate one above.</p>
                                ) : (
                                    <>
                                        <div className="settings-keys-scroll">
                                            <table className="settings-keys-table">
                                                <thead>
                                                    <tr>
                                                        <th>Name</th>
                                                        <th>Created</th>
                                                        <th>Last Used</th>
                                                        <th>Status</th>
                                                        <th></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {agentKeys.filter(k => k.active).map(k => (
                                                        <tr key={k.id}>
                                                            <td>
                                                                <span className="settings-key-name">{k.name}</span>
                                                                <code className="settings-key-prefix">{k.key_prefix}…</code>
                                                            </td>
                                                            <td>{formatDate(k.created_at)}</td>
                                                            <td>{k.last_used_at ? formatDate(k.last_used_at) : "Never"}</td>
                                                            <td><span className="settings-agent-status settings-agent-status-approved">Active</span></td>
                                                            <td>
                                                                <button className="settings-btn settings-btn-danger settings-key-revoke" onClick={() => void handleRevokeKey(k.id)}>
                                                                    <Trash size={15} weight="bold" /> Revoke
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        <button className="settings-revoked-toggle" onClick={() => setShowRevoked(v => !v)} aria-expanded={showRevoked}>
                                            {showRevoked ? 'Hide' : 'Show'} revoked ({agentKeys.filter(k => !k.active).length})
                                        </button>
                                        {showRevoked && (
                                            <div className="settings-keys-scroll">
                                                <table className="settings-keys-table settings-keys-table-revoked">
                                                    <tbody>
                                                        {agentKeys.filter(k => !k.active).map(k => (
                                                            <tr key={k.id}>
                                                                <td>
                                                                    <span className="settings-key-name">{k.name}</span>
                                                                    <code className="settings-key-prefix">{k.key_prefix}…</code>
                                                                </td>
                                                                <td>{formatDate(k.created_at)}</td>
                                                                <td>{k.last_used_at ? formatDate(k.last_used_at) : "Never"}</td>
                                                                <td><span className="settings-agent-status settings-agent-status-cancelled">Revoked</span></td>
                                                                <td></td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </>
                                )}
                            </>
                        )}

                        {tab === "activity" && (
                            <>
                                <div className="settings-activity-pills">
                                    {(["all", "approved", "rejected"] as const).map(f => (
                                        <button
                                            key={f}
                                            className={`settings-activity-pill${activityFilter === f ? " active" : ""}`}
                                            onClick={() => { setActivityFilter(f); setVisibleActivity(10) }}
                                        >
                                            {f.charAt(0).toUpperCase() + f.slice(1)}
                                        </button>
                                    ))}
                                </div>
                                {(() => {
                                    const rows = activity
                                        .filter(p => activityFilter === "all" || p.status === activityFilter)
                                        .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
                                    if (rows.length === 0) {
                                        return <p className="settings-muted">No activity yet.</p>
                                    }
                                    const shown = rows.slice(0, visibleActivity)
                                    return (
                                        <>
                                            <div className="settings-agent-activity">
                                                {shown.map(p => (
                                                    <div className="settings-agent-event" key={p.id}>
                                                        <span className={`settings-agent-status settings-agent-status-${p.status}`}>{p.status}</span>
                                                        <span className="settings-agent-event-desc">{describeActivity(p) ?? ""}</span>
                                                        <span className="settings-agent-event-date">
                                                            {new Date(p.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                            {rows.length > shown.length && (
                                                <button className="settings-activity-more" onClick={() => setVisibleActivity(v => v + 10)}>
                                                    <CaretDown size={16} weight="bold" />
                                                    Older activity
                                                </button>
                                            )}
                                        </>
                                    )
                                })()}
                            </>
                        )}

                        {tab === "config" && (
                            <>
                                <div className="settings-agent-row">
                                    <div className="settings-agent-info">
                                        <span className="settings-agent-row-title">Allow agents to act on my account</span>
                                        <span className="settings-agent-row-desc">
                                            Agents (Hermes, Claude Code, opencode…) can search jobs and propose actions; you approve each one before it happens.
                                        </span>
                                    </div>
                                    <Switch
                                        checked={Boolean(agentEnabled)}
                                        onChange={(e) => { void handleToggleAgents(e.currentTarget.checked) }}
                                        size="lg"
                                        color="teal"
                                    />
                                </div>

                                <div className="settings-agent-row">
                                    <div className="settings-agent-info">
                                        <span className="settings-agent-row-title">Show Agent hub in the tracker</span>
                                        <span className="settings-agent-row-desc">
                                            Adds an "Agent hub" tab to the Application Tracker where you review actions, manage rules for what the agent may do, and see activity.
                                        </span>
                                    </div>
                                    <Switch
                                        checked={showTrackerTab}
                                        onChange={(e) => { void handleToggleTrackerTab(e.currentTarget.checked) }}
                                        size="lg"
                                        color="teal"
                                    />
                                </div>

                                <div className="settings-skill-card">
                                    <div className="settings-skill-card-head">
                                        <Robot size={20} weight="bold" className="settings-section-icon" />
                                        <div className="settings-skill-card-info">
                                            <span className="settings-key-callout-title">Agent skill file</span>
                                            <p className="settings-muted">
                                                Teaches Claude Code, opencode, or Hermes how to use your key — search jobs, read your tracker and resume, and propose actions you approve in the Agent hub.
                                            </p>
                                        </div>
                                        <a
                                            href="/SKILL.md"
                                            download="SKILL.md"
                                            className="settings-btn settings-btn-primary"
                                        >
                                            <DownloadSimple size={16} weight="bold" />
                                            Download skill
                                        </a>
                                    </div>
                                    <p className="settings-muted settings-install-hint">
                                        Save it as <code className="settings-key-raw">SKILL.md</code> in one of these paths, then restart your agent:
                                    </p>
                                    <div className="settings-install-block">
                                        <code>.opencode/skills/searchtern/SKILL.md</code>
                                        <code>~/.config/opencode/skills/searchtern/SKILL.md</code>
                                        <code>~/.claude/skills/searchtern/SKILL.md</code>
                                    </div>
                                </div>
                            </>
                        )}
                    </>
                )}
            </section>
        </div>
    )
}

export default Settings