import { useCallback, useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { Modal } from "@mantine/core"
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

function Settings() {
    const { user, signOut } = useAuth()
    const [resume, setResume] = useState<ResumeRecord | null>(null)
    const [loading, setLoading] = useState(true)
    const [dragActive, setDragActive] = useState(false)
    const [preview, setPreview] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const displayName: string = user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? ''
    const displayEmail = user?.email ?? user?.user_metadata?.email ?? ''

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
                            You are browsing as a guest — your resume is stored only on this device.
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

            <Modal
                opened={Boolean(preview)}
                onClose={() => setPreview(null)}
                title={`Resume — ${resume?.name ?? ''}`}
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