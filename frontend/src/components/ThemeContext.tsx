import { createContext, useContext, useEffect, useState, type ReactNode } from "react"

const STORAGE_KEY = "searchtern_theme"

type Theme = "light" | "dark"

interface ThemeContextType {
    theme: Theme
    toggleTheme: () => void
    setTheme: (t: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

function initialTheme(): Theme {
    try {
        const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
        if (stored === "light" || stored === "dark") return stored
    } catch {
        /* ignore */
    }
    if (typeof window !== "undefined" && window.matchMedia) {
        return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
    }
    return "light"
}

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [theme, setTheme] = useState<Theme>(() => {
        if (typeof window === "undefined") return "light"
        return initialTheme()
    })

    useEffect(() => {
        const root = document.documentElement
        if (theme === "dark") root.setAttribute("data-theme", "dark")
        else root.removeAttribute("data-theme")
        try {
            localStorage.setItem(STORAGE_KEY, theme)
        } catch {
            /* ignore */
        }
    }, [theme])

    const toggleTheme = () => setTheme(t => (t === "dark" ? "light" : "dark"))

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    )
}

export const useTheme = () => {
    const ctx = useContext(ThemeContext)
    if (!ctx) throw new Error("useTheme must be used within a ThemeProvider")
    return ctx
}
