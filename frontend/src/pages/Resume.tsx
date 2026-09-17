import { useCallback, useEffect, useRef, useState } from "react"
import { useElementSize } from "@mantine/hooks"
import { Modal } from "@mantine/core"
import { notifications } from "@mantine/notifications"
import { Document, Page, pdfjs } from "react-pdf"
import "react-pdf/dist/Page/TextLayer.css"
import "react-pdf/dist/Page/AnnotationLayer.css"
import {
    CloudArrowUp,
    Files,
    FileText,
    Eye,
    ArrowSquareOut,
    Plus,
    DownloadSimple,
    Trash,
    CheckCircle,
    WarningCircle,
    Robot,
    Copy,
    NotePencil,
    PencilSimpleLine,
    Image as ImageIcon,
    Circle,
} from "@phosphor-icons/react"
import type { ResumeRecord } from "../services/resumeStorage"
import {
    fileToRecord,
    getLocalResumes,
    getActiveResumeId,
    upsertLocalResume,
    removeLocalResume,
    pushResumeToCloud,
    removeResumeFromCloud,
    syncResumeWithCloud,
    setActiveEverywhere,
    cloudAvailable,
    isValidResumeFile,
    uniqueResumeName,
} from "../services/resumeStorage"
import { useAuth } from "../components/AuthContext"
import { editPdfInPlace } from "../api/resumeEditor"
import "../styles/Settings.css"
import "../styles/Resume.css"

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
).toString()

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

function isPdf(name: string): boolean {
    return /\.pdf$/i.test(name)
}

function isPreviewable(name: string): boolean {
    return /\.(pdf|png|jpe?g|gif|svg|txt)$/i.test(name)
}

function isTextual(name: string): boolean {
    return /\.txt$/i.test(name)
}

function baseFileName(name: string): string {
    const dot = name.lastIndexOf('.')
    return dot > 0 ? name.slice(0, dot) : name
}

/** Extract plain text so the resume can be pasted into applications.
 *  PDF text items are clustered by baseline so each returned line matches a
 *  visual line — the same alignment the backend editor keys on. */
async function resumeToText(r: ResumeRecord): Promise<string | null> {
    const lower = r.name.toLowerCase()
    if (lower.endsWith('.txt')) {
        return await r.blob.text()
    }
    if (lower.endsWith('.pdf')) {
        const doc = await pdfjs.getDocument({ data: new Uint8Array(await r.blob.arrayBuffer()) }).promise
        const pages: string[] = []
        for (let p = 1; p <= doc.numPages; p++) {
            const page = await doc.getPage(p)
            const content = await page.getTextContent()
            const items = content.items
                .filter(it => 'str' in it)
                .map(it => ({
                    str: it.str as string,
                    x: (it.transform as number[])[4],
                    y: (it.transform as number[])[5],
                    size: Math.max(((it.transform as number[])[3] as number) ?? 0, 1),
                }))
            items.sort((a, b) => b.y - a.y || a.x - b.x)
            const lines: string[] = []
            let lastY: number | null = null
            for (const it of items) {
                if (lastY !== null && Math.abs(lastY - it.y) < 0.5 * it.size) {
                    lines[lines.length - 1] += ' ' + it.str
                } else {
                    lines.push(it.str)
                }
                lastY = it.y
            }
            pages.push(lines.join('\n'))
        }
        return pages.join('\n\n')
    }
    return null
}

function Resume() {
    const { user } = useAuth()
    const [resumes, setResumes] = useState<ResumeRecord[]>([])
    const [activeId, setActiveId] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [dragActive, setDragActive] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const { ref: pdfWrapRef, width: pdfWrapWidth } = useElementSize<HTMLDivElement>()
    const [numPages, setNumPages] = useState(0)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)

    const [renameTarget, setRenameTarget] = useState<ResumeRecord | null>(null)
    const [renameName, setRenameName] = useState("")
    const [editTarget, setEditTarget] = useState<ResumeRecord | null>(null)
    const [editText, setEditText] = useState("")
    const [editOriginal, setEditOriginal] = useState("")
    const [editLoading, setEditLoading] = useState(false)
    const [saving, setSaving] = useState(false)

    const userId = user?.id ?? ""
    const activeResume = resumes.find(r => r.id === activeId) ?? resumes[0] ?? null
    const current = activeResume?.name ?? ""

    const resumesRef = useRef(resumes)
    useEffect(() => { resumesRef.current = resumes }, [resumes])

    const loadAll = useCallback(async () => {
        if (userId) {
            await syncResumeWithCloud(userId, resumesRef.current)
        }
        const local = await getLocalResumes()
        const saved = await getActiveResumeId()
        const picked = saved && local.some(r => r.id === saved)
            ? saved
            : (local[0]?.id ?? null)
        setResumes(local)
        setActiveId(picked)
        setLoading(false)
    }, [userId])

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void loadAll()
    }, [loadAll])

    useEffect(() => {
        if (!activeResume || !isPreviewable(activeResume.name)) return
        const url = URL.createObjectURL(activeResume.blob)
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPreviewUrl(url)
        setNumPages(0)
        return () => URL.revokeObjectURL(url)
    }, [activeResume])

    const handleFile = useCallback(async (file: File | null) => {
        if (!file) return
        const error = isValidResumeFile(file)
        if (error) {
            notifications.show({ title: 'Invalid File', message: error, color: 'red', icon: <WarningCircle size={18} /> })
            return
        }
        const record = fileToRecord(file)
        record.name = uniqueResumeName(resumes.map(r => r.name), record.name)
        await upsertLocalResume(record)
        setResumes(prev => [record, ...prev])
        setActiveId(record.id)
        if (userId && cloudAvailable()) {
            await setActiveEverywhere(userId, record)
        }
        notifications.show({ title: 'Resume Saved', message: record.name, color: 'teal', icon: <CheckCircle size={18} /> })
    }, [resumes, userId])

    const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        setDragActive(false)
        const file = e.dataTransfer.files?.[0]
        if (file) void handleFile(file)
    }, [handleFile])

    const handleSetActive = useCallback(async (record: ResumeRecord) => {
        setActiveId(record.id)
        if (userId && cloudAvailable()) {
            await setActiveEverywhere(userId, record)
        }
        notifications.show({ title: 'Active resume set', message: `Agents will use ${record.name}.`, color: 'teal', icon: <CheckCircle size={18} /> })
    }, [userId])

    const handleRemove = useCallback(async (record: ResumeRecord) => {
        if (resumes.length === 1 && !window.confirm('Remove your last resume?')) return
        if (userId && cloudAvailable()) {
            await removeResumeFromCloud(userId, record)
        }
        await removeLocalResume(record.id)
        const remaining = resumes.filter(r => r.id !== record.id)
        setResumes(remaining)
        if (activeId === record.id) {
            setActiveId(remaining[0]?.id ?? null)
        }
        notifications.show({ title: 'Resume Removed', message: record.name, color: 'blue', icon: <CheckCircle size={18} /> })
    }, [resumes, activeId, userId])

    const downloadResume = useCallback((record: ResumeRecord) => {
        const url = URL.createObjectURL(record.blob)
        const a = document.createElement("a")
        a.href = url
        a.download = record.name
        document.body.appendChild(a)
        a.click()
        a.remove()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
    }, [])

    const handleCopy = useCallback(async (record: ResumeRecord) => {
        const text = await resumeToText(record)
        if (text === null) {
            notifications.show({
                title: 'Cannot copy',
                message: 'Extracting text from DOC/DOCX is not supported. Download it instead.',
                color: 'orange',
                icon: <WarningCircle size={18} />,
            })
            return
        }
        if (text.trim().length === 0) {
            notifications.show({
                title: 'Nothing to copy',
                message: 'No text could be extracted from this resume.',
                color: 'orange',
                icon: <WarningCircle size={18} />,
            })
            return
        }
        try {
            await navigator.clipboard.writeText(text)
            notifications.show({ title: 'Copied', message: `${record.name} text is on your clipboard.`, color: 'teal', icon: <CheckCircle size={18} /> })
        } catch {
            notifications.show({ title: 'Copy failed', message: 'Clipboard access was blocked by the browser.', color: 'red', icon: <WarningCircle size={18} /> })
        }
    }, [])

    const dropzoneProps = {
        onDragOver: (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setDragActive(true) },
        onDragLeave: () => setDragActive(false),
        onDrop: handleDrop,
    }

    const openRename = useCallback((record: ResumeRecord) => {
        setRenameTarget(record)
        setRenameName(record.name)
    }, [])

    const saveRename = useCallback(async () => {
        if (!renameTarget) return
        const newName = renameName.trim()
        if (!newName) {
            notifications.show({ title: 'Rename failed', message: 'Name cannot be empty.', color: 'red', icon: <WarningCircle size={18} /> })
            return
        }
        if (resumes.some(r => r.id !== renameTarget.id && r.name.toLowerCase() === newName.toLowerCase())) {
            notifications.show({ title: 'Rename failed', message: 'Another resume already has that name.', color: 'red', icon: <WarningCircle size={18} /> })
            return
        }
        const dot = newName.lastIndexOf('.')
        const fixed = dot > 0 ? newName : `${newName}${renameTarget.name.slice(renameTarget.name.lastIndexOf('.'))}`
        const updated = { ...renameTarget, name: fixed }
        await upsertLocalResume(updated)
        setResumes(prev => prev.map(r => (r.id === updated.id ? updated : r)))
        if (userId && cloudAvailable()) {
            await pushResumeToCloud(userId, updated)
            await removeResumeFromCloud(userId, renameTarget)
            if (activeId === updated.id) {
                await setActiveEverywhere(userId, updated)
            }
        }
        setRenameTarget(null)
        notifications.show({ title: 'Resume renamed', message: fixed, color: 'teal', icon: <CheckCircle size={18} /> })
    }, [renameTarget, renameName, resumes, userId, activeId])

    const openEdit = useCallback(async (record: ResumeRecord) => {
        setEditTarget(record)
        setEditText("")
        setEditOriginal("")
        setEditLoading(true)
        const text = await resumeToText(record)
        setEditLoading(false)
        setEditText(text ?? "")
        setEditOriginal(text ?? "")
    }, [])

    const saveEdit = useCallback(async () => {
        if (!editTarget) return
        setSaving(true)
        try {
            if (isTextual(editTarget.name)) {
                const updated = {
                    ...editTarget,
                    blob: new Blob([editText], { type: 'text/plain' }),
                    type: 'text/plain',
                    size: new Blob([editText]).size,
                    uploadedAt: new Date().toISOString(),
                }
                await upsertLocalResume(updated)
                setResumes(prev => prev.map(r => (r.id === updated.id ? updated : r)))
                if (userId && cloudAvailable()) {
                    await pushResumeToCloud(userId, updated)
                    if (activeId === updated.id) {
                        await setActiveEverywhere(userId, updated)
                    }
                }
                notifications.show({ title: 'Resume saved', message: updated.name, color: 'teal', icon: <CheckCircle size={18} /> })
            } else if (isPdf(editTarget.name)) {
                const blob = await editPdfInPlace(editTarget.blob, editTarget.name, editOriginal, editText)
                const editedName = uniqueResumeName(
                    resumes.map(r => r.name),
                    `${baseFileName(editTarget.name)} - edited.pdf`,
                )
                const record = fileToRecord(new File([blob], editedName, { type: 'application/pdf' }))
                await upsertLocalResume(record)
                setResumes(prev => [record, ...prev])
                setActiveId(record.id)
                if (userId && cloudAvailable()) {
                    await setActiveEverywhere(userId, record)
                }
                notifications.show({ title: 'Edited resume saved', message: editedName, color: 'teal', icon: <CheckCircle size={18} /> })
            } else {
                const textName = uniqueResumeName(
                    resumes.map(r => r.name),
                    `${baseFileName(editTarget.name)} - edited.txt`,
                )
                const record = fileToRecord(new File([editText], textName, { type: 'text/plain' }))
                await upsertLocalResume(record)
                setResumes(prev => [record, ...prev])
                setActiveId(record.id)
                if (userId && cloudAvailable()) {
                    await setActiveEverywhere(userId, record)
                }
                notifications.show({ title: 'Editable copy created', message: textName, color: 'teal', icon: <CheckCircle size={18} /> })
            }
            setEditTarget(null)
        } catch (err) {
            notifications.show({
                title: 'Edit failed',
                message: err instanceof Error
                    ? err.message
                    : 'The backend editor could not rewrite this PDF. Is the server running?',
                color: 'red',
                icon: <WarningCircle size={18} />,
            })
        } finally {
            setSaving(false)
        }
    }, [editTarget, editText, editOriginal, resumes, userId, activeId])

    const canPreview = activeResume && isPreviewable(activeResume.name)

    return (
        <div className="standard-layout">
            <div className="settings-header">
                <h2 className="settings-title">Resume</h2>
                <p className="settings-subtitle">Keep several resumes. Mark the one you want agents to use, and see it previewed live.</p>
            </div>

            <div className="resume-split">
                <section className="feature settings-section">
                    <div className="settings-section-header">
                        <Files size={24} weight="bold" className="settings-section-icon" />
                        <h3 className="settings-section-title">Your resumes</h3>
                    </div>

                    {loading ? (
                        <p className="settings-muted">Loading your resumes…</p>
                    ) : resumes.length === 0 ? (
                        <div className="resume-empty">
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
                            <p className="settings-muted resume-empty-note">
                                {user && cloudAvailable()
                                    ? 'Your resumes are synced to your account and available to your agents on all devices.'
                                    : 'Your resumes are stored locally on this device.'}
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="resume-list">
                                {resumes.map(r => {
                                    const isActive = r.id === activeId
                                    return (
                                        <div className={`resume-row${isActive ? ' active' : ''}`} key={r.id}>
                                            <button
                                                className={`resume-select${isActive ? ' selected' : ''}`}
                                                onClick={() => void handleSetActive(r)}
                                                title={isActive ? 'Active resume' : 'Use this resume with agents'}
                                            >
                                                {isActive ? <CheckCircle size={20} weight="fill" /> : <Circle size={20} />}
                                            </button>
                                            <div className="resume-row-info">
                                                <span className="resume-row-name">
                                                    {r.name}
                                                    {isActive && <span className="resume-row-badge">Active</span>}
                                                </span>
                                                <span className="resume-row-meta">
                                                    {formatBytes(r.size)} · uploaded {formatDate(r.uploadedAt)}
                                                </span>
                                                <div className="resume-row-actions">
                                                    <button className="settings-btn settings-btn-secondary" onClick={() => void handleCopy(r)} title="Copy resume text to clipboard">
                                                        <Copy size={15} weight="bold" />
                                                        Copy
                                                    </button>
                                                    <button className="settings-btn settings-btn-secondary" onClick={() => void openEdit(r)} title="Edit resume text">
                                                        <NotePencil size={15} weight="bold" />
                                                        Edit
                                                    </button>
                                                    <button className="settings-btn settings-btn-secondary" onClick={() => openRename(r)} title="Rename">
                                                        <PencilSimpleLine size={15} weight="bold" />
                                                        Rename
                                                    </button>
                                                    <button className="settings-btn settings-btn-secondary" onClick={() => downloadResume(r)} title="Download">
                                                        <DownloadSimple size={15} weight="bold" />
                                                        Download
                                                    </button>
                                                    <button className="settings-btn settings-btn-danger" onClick={() => void handleRemove(r)} title="Remove">
                                                        <Trash size={15} weight="bold" />
                                                        Remove
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>

                            <div
                                className={`settings-dropzone${dragActive ? ' active' : ''} resume-add-dropzone`}
                                onClick={() => fileInputRef.current?.click()}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click() }}
                                {...dropzoneProps}
                            >
                                <Plus size={20} weight="bold" className="settings-dropzone-icon" />
                                <span>Add another resume — drop it here or <em>click to browse</em></span>
                            </div>
                            <p className="settings-muted resume-agent-note">
                                <Robot size={15} weight="bold" /> The Active resume is what your agents are told to use.
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

                <section className="feature settings-section resume-viewer">
                    <div className="settings-section-header">
                        <Eye size={24} weight="bold" className="settings-section-icon" />
                        <h3 className="settings-section-title">Preview {current && `· ${current}`}</h3>
                        {previewUrl && (
                            <button className="settings-btn settings-btn-ghost resume-open-btn" onClick={() => window.open(previewUrl, "_blank")} title="Open in a new tab">
                                <ArrowSquareOut size={14} weight="bold" />
                                Open
                            </button>
                        )}
                    </div>

                    {activeResume && canPreview && isPdf(current) && previewUrl ? (
                        <div ref={pdfWrapRef} className="resume-pdf-wrap">
                            <Document
                                file={previewUrl}
                                onLoadSuccess={({ numPages: n }) => setNumPages(n)}
                                loading={<p className="settings-muted resume-pdf-status">Loading PDF…</p>}
                                error={<p className="settings-muted resume-pdf-status">Couldn't load this PDF.</p>}
                            >
                                {Array.from({ length: numPages }, (_, i) => (
                                    <Page
                                        key={`${activeResume.id}-${i + 1}`}
                                        pageNumber={i + 1}
                                        width={Math.floor(pdfWrapWidth) || undefined}
                                        className="resume-pdf-page"
                                    />
                                ))}
                            </Document>
                        </div>
                    ) : activeResume && canPreview && previewUrl ? (
                        <iframe
                            src={previewUrl}
                            title={`Preview of ${current}`}
                            className="resume-viewer-frame"
                        />
                    ) : activeResume ? (
                        <div className="resume-viewer-empty">
                            <ImageIcon size={40} weight="thin" className="resume-viewer-empty-icon" />
                            <p className="settings-muted">
                                {current} can't be previewed in the browser. Download it to view, or copy its text into an application.
                            </p>
                            <button className="settings-btn settings-btn-primary" onClick={() => downloadResume(activeResume)}>
                                <DownloadSimple size={16} weight="bold" />
                                Download
                            </button>
                        </div>
                    ) : (
                        <div className="resume-viewer-empty">
                            <FileText size={40} weight="thin" className="resume-viewer-empty-icon" />
                            <p className="settings-muted">Upload a resume to preview it here.</p>
                        </div>
                    )}
                </section>
            </div>

            <Modal
                opened={Boolean(renameTarget)}
                onClose={() => setRenameTarget(null)}
                title="Rename resume"
                size="sm"
                centered
            >
                <div className="resume-modal-body">
                    <input
                        className="settings-key-input"
                        value={renameName}
                        onChange={(e) => setRenameName(e.target.value)}
                        maxLength={120}
                        onKeyDown={(e) => { if (e.key === 'Enter') void saveRename() }}
                        autoFocus
                    />
                    <div className="resume-modal-actions">
                        <button className="settings-btn settings-btn-ghost" onClick={() => setRenameTarget(null)}>Cancel</button>
                        <button className="settings-btn settings-btn-primary" onClick={() => void saveRename()} disabled={!renameName.trim() || saving}>
                            Save
                        </button>
                    </div>
                </div>
            </Modal>

            <Modal
                opened={Boolean(editTarget)}
                onClose={() => setEditTarget(null)}
                title={`Edit ${editTarget?.name ?? ''}`}
                size="xl"
                centered
            >
                <div className="resume-modal-body">
                    <textarea
                        className="resume-edit-area"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        placeholder="Select text to edit…"
                        disabled={editLoading || !editText}
                        spellCheck={false}
                    />
                    {isTextual(editTarget?.name ?? "") ? (
                        <p className="settings-muted">Saving overwrites this resume.</p>
                    ) : isPdf(editTarget?.name ?? "") ? (
                        <p className="settings-muted resume-edit-note">
                            <WarningCircle size={14} weight="bold" /> Saving rewrites this PDF's layout in place — changed lines are re-rendered on the
                            original document. Large structural rewrites may overlap; the original file is never touched.
                        </p>
                    ) : (
                        <p className="settings-muted">
                            This file isn't plain text. Saving creates a new <code className="settings-key-raw">.txt</code> resume from the text above;
                            the original is kept untouched.
                        </p>
                    )}
                    <div className="resume-modal-actions">
                        <button className="settings-btn settings-btn-ghost" onClick={() => setEditTarget(null)}>Cancel</button>
                        <button
                            className="settings-btn settings-btn-primary"
                            onClick={() => void saveEdit()}
                            disabled={saving || editLoading || editText.trim().length === 0}
                        >
                            {isTextual(editTarget?.name ?? "")
                                ? 'Save changes'
                                : isPdf(editTarget?.name ?? '')
                                    ? 'Save edits to PDF'
                                    : 'Save as new .txt resume'}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}

export default Resume