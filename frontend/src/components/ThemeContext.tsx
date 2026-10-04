import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { useAuth } from "./AuthContext"

const STORAGE_KEY = "searchtern_theme"

type Theme = "light" | "dark"

interface ThemeContextType {
    theme: Theme
    toggleTheme: () => void
    setTheme: (t: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

/** null means this visitor has never picked a theme themselves. */
function storedPreference(): Theme | null {
    try {
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
    // reload would flash white before the pin applies. A signed-in visitor with
    // no stored preference of their own defaults to dark.
    const activeTheme: Theme = loading
        ? (choice ?? "light")
        : (user ? (choice ?? "dark") : "light")

    useEffect(() => {
        const root = document.documentElement
        if (activeTheme === "dark") root.setAttribute("data-theme", "dark")
        else root.removeAttribute("data-theme")
        // Only a signed-in visitor's choice is worth persisting — otherwise
        // signing out would overwrite the preference they had.
        if (user) {
            try {
                localStorage.setItem(STORAGE_KEY, activeTheme)
            } catch {
                /* ignore */
            }
        }
    }, [activeTheme, user])

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
