import { useCallback, useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { Modal, Switch } from "@mantine/core"
import { notifications } from "@mantine/notifications"
import {
    CloudArrowUp,
    FileText,
    Eye,
    DownloadSimple,
    Trash,
    CheckCircle,
    WarningCircle,
    ArrowClockwise,
    SignIn,
    UserCircle,
    ShieldCheck,
    Info,
    Robot,
    Key,
    Plus,
    Copy,
    X,
} from "@phosphor-icons/react"
import { useAuth } from "../components/AuthContext"
import "../styles/Settings.css"
import {
    type ResumeRecord,
    fileToRecord,
    getLocalResume,
    saveLocalResume,
    clearLocalResume,
    pushResumeToCloud,
    removeResumeFromCloud,
    syncResumeWithCloud,
    cloudAvailable,
    isValidResumeFile,
} from "../services/resumeStorage"
import {
    fetchAgentKeys,
    createAgentKey,
    revokeAgentKey,
    fetchAgentSettings,
    setAgentSettings,
    fetchAgentActivity,
    type AgentKey,
    type AgentProposal,
    type CreatedAgentKey,
} from "../api/agent"

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

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
    const [resume, setResume] = useState<ResumeRecord | null>(null)
    const [loading, setLoading] = useState(true)
    const [dragActive, setDragActive] = useState(false)
    const [preview, setPreview] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const userId = user?.id ?? ""
    const [agentsAvailable, setAgentsAvailable] = useState<boolean | null>(null)
    const [agentEnabled, setAgentEnabled] = useState<boolean | null>(null)
    const [showTrackerTab, setShowTrackerTab] = useState(false)
    const [agentKeys, setAgentKeys] = useState<AgentKey[]>([])
    const [keyName, setKeyName] = useState("")
    const [creating, setCreating] = useState(false)
    const [createdKey, setCreatedKey] = useState<CreatedAgentKey | null>(null)
    const [activity, setActivity] = useState<AgentProposal[]>([])

    const displayName: string = user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? ''
    const displayEmail = user?.email ?? user?.user_metadata?.email ?? ''

    const loadAgentData = useCallback(async () => {
        if (!userId) {
            setAgentsAvailable(false)
            setAgentKeys([])
            setActivity([])
            return
        }
        const [settings, keys] = await Promise.all([
            fetchAgentSettings(userId),
            fetchAgentKeys(userId),
        ])
        if (settings === null) {
            setAgentsAvailable(false)
            return
        }
        setAgentsAvailable(true)
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

    useEffect(() => {
        let cancelled = false
        ;(async () => {
            if (user?.id) {
                await syncResumeWithCloud(user.id)
            }
            const local = await getLocalResume()
            if (!cancelled) {
                setResume(local)
                setLoading(false)
            }
        })()
        return () => { cancelled = true }
    }, [user?.id])

    useEffect(() => {
        return () => {
            if (preview) URL.revokeObjectURL(preview)
        }
    }, [preview])

    const handleFile = useCallback(async (file: File | null) => {
        if (!file) return
        const error = isValidResumeFile(file)
        if (error) {
            notifications.show({ title: 'Invalid File', message: error, color: 'red', icon: <WarningCircle size={18} /> })
            return
        }
        const record = fileToRecord(file)
        setResume(record)
        await saveLocalResume(record)
        if (user?.id && cloudAvailable()) {
            if (resume && resume.name !== record.name) {
                await removeResumeFromCloud(user.id, resume)
            }
            const pushed = await pushResumeToCloud(user.id, record)
            if (!pushed.ok) {
                notifications.show({
                    title: 'Cloud Sync Failed',
                    message: 'Saved locally, but could not sync to your account: ' + pushed.error,
                    color: 'orange',
                    icon: <WarningCircle size={18} />,
                })
                return
            }
        }
        notifications.show({ title: 'Resume Saved', message: record.name, color: 'teal', icon: <CheckCircle size={18} /> })
    }, [user?.id, resume])

    const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        setDragActive(false)
        const file = e.dataTransfer.files?.[0]
        if (file) void handleFile(file)
    }, [handleFile])

    const handleRemove = useCallback(async () => {
        if (!resume) return
        if (user?.id && cloudAvailable()) {
            await removeResumeFromCloud(user.id, resume)
        }
        await clearLocalResume()
        setResume(null)
        notifications.show({ title: 'Resume Removed', message: 'Your resume has been deleted.', color: 'blue', icon: <CheckCircle size={18} /> })
    }, [resume, user?.id])

    const openPreview = useCallback(() => {
        if (!resume) return
        const isDoc = /\.docx?$/i.test(resume.name)
        if (isDoc) {
            notifications.show({
                title: 'Preview Not Available',
                message: 'DOC/DOCX cannot be previewed in the browser. Use Download instead.',
                color: 'blue',
                icon: <Info size={18} />,
            })
            return
        }
        const url = URL.createObjectURL(resume.blob)
        setPreview(url)
    }, [resume])

    const downloadResume = useCallback(() => {
        if (!resume) return
        const url = URL.createObjectURL(resume.blob)
        const a = document.createElement("a")
        a.href = url
        a.download = resume.name
        document.body.appendChild(a)
        a.click()
        a.remove()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
    }, [resume])

    const dropzoneProps = {
        onDragOver: (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setDragActive(true) },
        onDragLeave: () => setDragActive(false),
        onDrop: handleDrop,
    }

    const handleToggleAgents = useCallback(async (enabled: boolean) => {
        const next = await setAgentSettings(userId, { enabled })
        if (next === null) {
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
    }, [userId])

    const handleToggleTrackerTab = useCallback(async (show: boolean) => {
        const next = await setAgentSettings(userId, { showTrackerTab: show })
        if (next === null) {
            notifications.show({ title: 'Update failed', message: 'Could not update agent settings.', color: 'red', icon: <WarningCircle size={18} /> })
            return
        }
        setShowTrackerTab(next.showTrackerTab)
        if (next.showTrackerTab) {
            notifications.show({ title: 'Agent hub enabled', message: 'The Agent hub tab now appears at the top of the Application Tracker.', color: 'teal', icon: <Robot size={18} weight="bold" /> })
        }
    }, [userId])

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
                <p className="settings-subtitle">Manage your account and your resume.</p>
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

            {/* Resume */}
            <section className="feature settings-section">
                <div className="settings-section-header">
                    <FileText size={24} weight="bold" className="settings-section-icon" />
                    <h3 className="settings-section-title">Resume</h3>
                </div>

                {loading ? (
                    <p className="settings-muted">Loading your resume…</p>
                ) : resume ? (
                    <>
                        <div className="settings-file">
                            <FileText size={28} weight="bold" className="settings-file-icon" />
                            <div className="settings-file-info">
                                <span className="settings-file-name">{resume.name}</span>
                                <span className="settings-file-meta">
                                    {formatBytes(resume.size)} · uploaded {formatDate(resume.uploadedAt)}
                                </span>
                            </div>
                            <div className="settings-file-actions">
                                <button className="settings-btn settings-btn-primary" onClick={openPreview}>
                                    <Eye size={16} weight="bold" />
                                    View
                                </button>
                                <button className="settings-btn settings-btn-secondary" onClick={downloadResume}>
                                    <DownloadSimple size={16} weight="bold" />
                                    Download
                                </button>
                                <button className="settings-btn settings-btn-danger" onClick={handleRemove}>
                                    <Trash size={16} weight="bold" />
                                    Remove
                                </button>
                            </div>
                        </div>
                        <p className="settings-muted settings-replace-hint">
                            To use a different file, drop it below or click to browse.
                        </p>
                        <div
                            className={`settings-dropzone${dragActive ? ' active' : ''}${resume ? ' compact' : ''}`}
                            onClick={() => fileInputRef.current?.click()}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click() }}
                            {...dropzoneProps}
                        >
                            <ArrowClockwise size={20} weight="bold" className="settings-dropzone-icon" />
                            <span>Drop to replace, or <em>click to browse</em></span>
                            <span className="settings-dropzone-hint">PDF, DOC, DOCX, TXT · max 5 MB</span>
                        </div>
                    </>
                ) : (
                    <>
                        <div
                            className={`settings-dropzone${dragActive ? ' active' : ''}`}
                            onClick={() => fileInputRef.current?.click()}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click() }}
                            {...dropzoneProps}
                        >
                            <CloudArrowUp size={34} weight="bold" className="settings-dropzone-icon" />
                            <span className="settings-dropzone-title">Drag &amp; drop your resume here</span>
                            <span className="settings-dropzone-sub">or click to browse from your computer</span>
                            <span className="settings-dropzone-hint">PDF, DOC, DOCX, TXT · max 5 MB</span>
                        </div>
                        <p className="settings-muted">
                            {user && cloudAvailable()
                                ? 'Your resume is synced to your account and available on all your devices.'
                                : 'Your resume is stored locally on this device.'}
                        </p>
                    </>
                )}

                <input
                    ref={fileInputRef}
                    type="file"
                    hidden
                    accept=".pdf,.doc,.docx,.txt"
                    onChange={(e) => {
                        const file = e.target.files?.[0]
                        void handleFile(file ?? null)
                        e.target.value = ''
                    }}
                />
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
                        <p className="settings-muted">
                            Agent tools are unavailable right now. Make sure the backend is running
                            and that <code>VITE_API_KEY</code> in <code>frontend/.env.local</code> matches
                            <code> API_KEY</code> in <code>backend/.env</code>.
                        </p>
                        <button className="settings-btn settings-btn-secondary" onClick={() => void loadAgentData()} disabled={!loadAgentData}>
                            <ArrowClockwise size={16} weight="bold" />
                            Retry
                        </button>
                    </div>
                ) : (
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

                                {agentKeys.length > 0 && (
                                    <div className="settings-keys">
                                        {agentKeys.map(k => (
                                            <div className="settings-key-row" key={k.id}>
                                                <span className="settings-key-name">{k.name}</span>
                                                {!k.active && <span className="settings-agent-status settings-agent-status-cancelled">revoked</span>}
                                                <code className="settings-key-prefix">{k.key_prefix}…</code>
                                                <span className="settings-key-meta">
                                                    created {formatDate(k.created_at)}
                                                    {k.last_used_at ? ` · used ${formatDate(k.last_used_at)}` : ' · never used'}
                                                </span>
                                                <button className="settings-btn settings-btn-danger settings-key-revoke" onClick={() => void handleRevokeKey(k.id)}>
                                                    <Trash size={15} weight="bold" /> Revoke
                                                </button>
                                            </div>
                                        ))}
</div>
                            )}

                        {activity.length > 0 && (
                            <div className="settings-agent-activity">
                                <span className="settings-agent-activity-title">Recent agent activity</span>
                                {activity.slice(0, 10).map(p => (
                                    <div className="settings-agent-event" key={p.id}>
                                        <span className={`settings-agent-status settings-agent-status-${p.status}`}>{p.status}</span>
                                        <span className="settings-agent-event-desc">{describeActivity(p)}</span>
                                        <span className="settings-agent-event-date">
                                            {new Date(p.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </section>

            <Modal
                opened={Boolean(preview)}
                onClose={() => setPreview(null)}
                title={`Resume - ${resume?.name ?? ''}`}
                size="lg"
                centered
                styles={{ body: { padding: 0 } }}
            >
                {preview && (
                    <iframe
                        src={preview}
                        title="Resume preview"
                        className="settings-preview-frame"
                    />
                )}
            </Modal>
        </div>
    )
}

export default Settings