import { Component, lazy, Suspense } from "react"
import type { ReactNode } from "react"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { SpeedInsights } from "@vercel/speed-insights/react"
import { Analytics } from "@vercel/analytics/react"
import Navbar from "./components/Navbar"
import { TrackerProvider } from "./components/TrackerContext"
import { AuthProvider } from "./components/AuthContext"
import { AgentOverlay } from "./components/AgentOverlay"
import { usePageMeta } from "./utils/seo"
import type { PageMeta } from "./utils/seo"

// Split per route: react-pdf (Resume/Settings), dnd-kit (Tracker) and the
// agent panel are dead weight on the job board, and the board is the landing
// page. Costs one extra RTT on navigation, saves ~half the first-load bundle.
const Home = lazy(() => import("./pages/Home"))
const Jobs = lazy(() => import("./pages/Jobs"))
const JobDetail = lazy(() => import("./pages/JobDetail"))
const Tracker = lazy(() => import("./pages/Tracker"))
const Auth = lazy(() => import("./pages/Auth"))
const Settings = lazy(() => import("./pages/Settings"))
const Privacy = lazy(() => import("./pages/Privacy"))

const SITE_ORG = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "SearchTern",
    url: "https://searchtern.ksaif.dev",
    logo: "https://searchtern.ksaif.dev/favicon.png",
}

function RouteMeta({ meta }: { meta: PageMeta }) {
    usePageMeta(meta)
    return null
}

// A deploy renames every hashed chunk and deletes the old ones in the same
// instant, so a tab that was open across one 404s its next lazy load -- on a
// route change, or when a modal pulls in its own chunk. Every deploy breaks
// every open tab, and the user sees a half-rendered page or nothing at all.
//
// Reload once to pick up the new build. The sessionStorage guard is the point:
// a chunk that is genuinely missing (a bad import path) must not reload
// forever, so this fires at most once per tab session and then falls through
// to the Reload button. sessionStorage rather than a module flag because it
// has to survive the reload it triggers, and it dies with the tab, so the next
// visit gets a fresh attempt.
//
// Deliberately not keyed on the failing URL: by the time a stale tab asks for
// it, the right answer is the same either way -- re-fetch the document.
export const CHUNK_ERROR_RE = /dynamically imported module|module script/i
const RELOAD_GUARD_KEY = "st:chunk-reload"

export function reloadOnceForNewBuild() {
    try {
        if (sessionStorage.getItem(RELOAD_GUARD_KEY)) return
        sessionStorage.setItem(RELOAD_GUARD_KEY, "1")
    } catch {
        // Private mode / storage disabled: the guard can't work, but a reload
        // is still better than a permanently broken page. Accept the loop risk
        // rather than stranding the user.
    }
    window.location.reload()
}

// A failed lazy() chunk import leaves the Suspense fallback stuck forever
// (React doesn't retry). Catch it and offer a reload instead of a silent
// "Loading..." page.
class RouteErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
    state = { failed: false }

    static getDerivedStateFromError() {
        return { failed: true }
    }

    componentDidCatch(error: unknown) {
        if (error instanceof Error && CHUNK_ERROR_RE.test(error.message)) {
            reloadOnceForNewBuild()
        }
    }

    render() {
        if (this.state.failed) {
            return (
                <p className="home-empty">
                    Couldn&apos;t load this page.{" "}
                    <button className="health_btn" onClick={() => window.location.reload()}>Reload</button>
                </p>
            )
        }
        return this.props.children
    }
}

function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <TrackerProvider>
                    <div>
                        <Navbar />
                        <div className="app-content">
                            <RouteErrorBoundary>
                            <Suspense fallback={<p className="home-empty">Loading...</p>}>
                            <Routes>
                                <Route
                                    path="/"
                                    element={
                                        <>
                                            <RouteMeta meta={{
                                                title: "SearchTern",
                                                description: "Find thousands of active software internships and new-grad jobs, then track your applications in one place.",
                                                path: "/",
                                                jsonLd: [SITE_ORG, {
                                                    "@context": "https://schema.org",
                                                    "@type": "WebSite",
                                                    name: "SearchTern",
                                                    url: "https://searchtern.ksaif.dev",
                                                }],
                                            }} />
                                            <Home />
                                        </>
                                    }
                                />
                                <Route
                                    path="/jobs"
                                    element={
                                        <>
                                            <RouteMeta meta={{
                                                title: "SearchTern · Internships",
                                                description: "Browse thousands of active software engineering internships and new-grad positions. Filter by company, role, location, FAANG status, and company size.",
                                                path: "/jobs",
                                            }} />
                                            <main className="standard-layout"><Jobs /></main>
                                        </>
                                    }
                                />
                                <Route
                                    path="/jobs/:id"
                                    element={
                                        <main className="standard-layout"><JobDetail /></main>
                                    }
                                />
                                <Route
                                    path="/tracker"
                                    element={
                                        <>
                                            <RouteMeta meta={{
                                                title: "SearchTern · Tracker",
                                                description: "Track every internship and new-grad application you've saved — Saved, Applied, Interview, Offer, and Rejected in one dashboard.",
                                                path: "/tracker",
                                            }} />
                                            <main className="full-width-layout"><Tracker /></main>
                                        </>
                                    }
                                />
                                <Route path="/resume" element={<Navigate to="/settings" replace />} />
                                <Route
                                    path="/auth"
                                    element={
                                        <>
                                            <RouteMeta meta={{
                                                title: "SearchTern · Log In",
                                                description: "Log in or create a free SearchTern account to track internship applications across every stage.",
                                                path: "/auth",
                                            }} />
                                            <main className="auth-wrapper"><Auth /></main>
                                        </>
                                    }
                                />
                                <Route
                                    path="/privacy"
                                    element={
                                        <>
                                            <RouteMeta meta={{
                                                title: "SearchTern · Privacy",
                                                description: "How SearchTern collects, uses, and protects your data.",
                                                path: "/privacy",
                                            }} />
                                            <main className="standard-layout"><Privacy /></main>
                                        </>
                                    }
                                />
                                <Route
                                    path="/settings"
                                    element={
                                        <>
                                            <RouteMeta meta={{
                                                title: "SearchTern · Settings",
                                                description: "Manage your SearchTern account settings, integrations, and AI agent preferences.",
                                                path: "/settings",
                                            }} />
                                            <main className="standard-layout"><Settings /></main>
                                        </>
                                    }
                                />
                            </Routes>
                            </Suspense>
                        </RouteErrorBoundary>
                        </div>
                        <AgentOverlay />
                        <SpeedInsights />
                        <Analytics />
                    </div>
                </TrackerProvider>
            </AuthProvider>
        </BrowserRouter>
    )
}

export default App