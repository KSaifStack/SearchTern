import { useEffect } from "react"
import { notifications } from "@mantine/notifications"
import { MoonStars } from "@phosphor-icons/react"
import { useAuth } from "./AuthContext"

/**
 * Signed-out visitors are pinned to light (see ThemeContext), because the
 * theme toggle lives behind the account-gated Settings page. If their device
 * asks for dark, say so in a toast rather than silently ignoring their OS
 * preference. Keyed off sessionStorage so it fires once, not on every reload.
 */
const NUDGE_KEY = "searchtern_theme_nudge"

export default function ThemeNudge() {
    const { user, loading } = useAuth()

    useEffect(() => {
        if (loading || user) return

        const devicePrefersDark =
            typeof window !== "undefined" &&
            typeof window.matchMedia === "function" &&
            window.matchMedia("(prefers-color-scheme: dark)").matches
        if (!devicePrefersDark) return

        try {
            if (sessionStorage.getItem(NUDGE_KEY)) return
            sessionStorage.setItem(NUDGE_KEY, "1")
        } catch {
            /* ignore */
        }

        notifications.show({
            title: "Dark mode available",
            message:
                "Your device is set to dark mode. Sign in to switch SearchTern to it.",
            color: "blue",
            icon: <MoonStars size={18} weight="fill" />,
            autoClose: 8000,
        })
    }, [loading, user])

    return null
}