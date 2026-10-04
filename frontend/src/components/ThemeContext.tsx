import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { useAuth } from "./AuthContext"

const STORAGE_KEY = "searchtern_theme"
// The pre-paint script in index.html and this provider both have to decide the
// theme before the session resolves, so neither can tell a signed-in visitor's
// choice from a leftover key. This marker is that distinction: it is only ever
// written while signed in, so a key without it isn't ours to apply.
const AUTHED_KEY = "searchtern_theme_authed"

type Theme = "light" | "dark"

interface ThemeContextType {
    theme: Theme
    toggleTheme: () => void
    setTheme: (t: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

/** null means this visitor has never picked a theme themselves while signed in. */
function storedPreference(): Theme | null {
    try {
        if (localStorage.getItem(AUTHED_KEY) !== "1") return null
        const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
        return stored === "light" || stored === "dark" ? stored : null
    } catch {
        return null
    }
}

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user, loading } = useAuth()
    const [choice, setChoice] = useState<Theme | null>(() => storedPreference())

    // Signed-out visitors are pinned to light: Settings is account-scoped and
    // holds the only theme toggle, so dark is unreachable for them. While the
    // session is still resolving we honour any stored choice, otherwise every
    // reload would flash white before the pin applies — storedPreference() gates
    // that on the marker, so a guest's leftover key never gets painted dark for
    // the frames it takes the session to resolve. A signed-in visitor with no
    // stored preference of their own defaults to dark.
    const activeTheme: Theme = loading
        ? (choice ?? "light")
        : (user ? (choice ?? "dark") : "light")

    useEffect(() => {
        const root = document.documentElement
        if (activeTheme === "dark") root.setAttribute("data-theme", "dark")
        else root.removeAttribute("data-theme")
        // Still resolving: leave storage alone, or we'd wipe a signed-in
        // visitor's preference on every reload before their session comes back.
        if (loading) return
        try {
            if (user) {
                localStorage.setItem(STORAGE_KEY, activeTheme)
                localStorage.setItem(AUTHED_KEY, "1")
            } else {
                // Drop both rather than just the marker. Keeping the preference
                // would let the pre-paint script paint dark for a visitor we're
                // pinning to light; the trade is that a choice doesn't survive a
                // sign-out, and signing back in falls back to the dark default.
                localStorage.removeItem(STORAGE_KEY)
                localStorage.removeItem(AUTHED_KEY)
            }
        } catch {
            /* ignore */
        }
    }, [activeTheme, user, loading])

    const toggleTheme = () => setChoice(activeTheme === "dark" ? "light" : "dark")

    return (
        <ThemeContext.Provider value={{ theme: activeTheme, toggleTheme, setTheme: (t: Theme) => setChoice(t) }}>
            {children}
        </ThemeContext.Provider>
    )
}

export const useTheme = () => {
    const ctx = useContext(ThemeContext)
    if (!ctx) throw new Error("useTheme must be used within a ThemeProvider")
    return ctx
}
