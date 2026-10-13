import { useEffect, useState } from "react"
import { useAuth } from "./AuthContext"
import "../styles/ChangesNotice.css"

/**
 * One-time overlay for returning (signed-in) users: the site moved to
 * searchtern.net and listings are no longer CS-only. Shows once per account
 * per browser, then never again (localStorage flag).
 */
function changesKey(userId: string | undefined): string {
    return `searchtern_changes_notice_v3_${userId || "anon"}`
}

export default function ChangesNotice() {
    const { user, loading } = useAuth()
    const [open, setOpen] = useState(false)

    useEffect(() => {
        if (loading) return
        // Signed-out preview in dev; prod only shows this to returning users.
        const preview = import.meta.env.DEV && !user
        if (!user && !preview) return

        const key = changesKey(user?.id)
        try {
            if (localStorage.getItem(key)) return
            localStorage.setItem(key, "1")
        } catch {
            /* private mode — fine to show it again */
        }
        setOpen(true)
    }, [loading, user])

    if (!open) return null

    return (
        <div className="changes-overlay" role="dialog" aria-modal="true" aria-label="SearchTern has expanded">
            <div className="changes-modal">
                <button className="changes-close-btn" onClick={() => setOpen(false)} aria-label="Close">✕</button>
                <h2 className="changes-title">
                    <img src="/favicon.png" alt="SearchTern" className="changes-logo" />
                    <span>Search</span><span className="changes-accent">Tern</span>
                    <span className="changes-sub">has expanded</span>
                </h2>
                <p className="changes-body">
                    SearchTern now lives at <strong>searchtern.net</strong> and covers internships
                    across every field, from data and hardware to finance and design.
                </p>
                <button className="changes-btn" onClick={() => setOpen(false)}>Got it</button>
            </div>
        </div>
    )
}