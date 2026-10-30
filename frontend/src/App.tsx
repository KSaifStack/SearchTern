import { lazy, Suspense } from "react"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { SpeedInsights } from "@vercel/speed-insights/react"
import { Analytics } from "@vercel/analytics/react"
import Navbar from "./components/Navbar"
import ThemeNudge from "./components/ThemeNudge"
import ChangesNotice from "./components/ChangesNotice"
import { TrackerProvider } from "./components/TrackerContext"
import { AgentOverlay } from "./components/AgentOverlay"
import ErrorBoundary from "./components/ErrorBoundary"
import { usePageMeta } from "./utils/seo"
import type { PageMeta } from "./utils/seo"
import { useAuth } from "./components/AuthContext"

// Route-level code splitting. Every page used to be pulled into the one entry
// bundle, so opening /jobs paid to parse JobDetail, Tracker, Settings and the
// PDF code before the list could paint.
const Home = lazy(() => import("./pages/Home"))
const Landing = lazy(() => import("./pages/Landing"))
const Jobs = lazy(() => import("./pages/Jobs"))
const JobDetail = lazy(() => import("./pages/JobDetail"))
const Tracker = lazy(() => import("./pages/Tracker"))
const Auth = lazy(() => import("./pages/Auth"))
const Privacy = lazy(() => import("./pages/Privacy"))
const Settings = lazy(() => import("./pages/Settings"))

const SITE_ORG = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "SearchTern",
    url: "https://searchtern.net",
    logo: "https://searchtern.net/favicon.png",
}

function RouteMeta({ meta }: { meta: PageMeta }) {
    usePageMeta(meta)
    return null
}

function HomeRoute() {
    const { user, loading } = useAuth()
    if (loading) return <div className="page-loading">Loading...</div>
    if (user) {
        return (
            <>
                <RouteMeta meta={{
                    title: "Dashboard | SearchTern",
                    description: "Your SearchTern dashboard and recommended opportunities.",
                    path: "/",
                }} />
                <Home />
            </>
        )
    }
    return (
        <>
            <RouteMeta meta={{
                title: "SearchTern | Open-Source Internship & New-Grad Tracker",
                description: "SearchTern pulls internships and new-grad roles directly from company ATS systems and adds H-1B sponsorship data where available. Free, open source, and built to track every application.",
                path: "/",
                jsonLd: [SITE_ORG, {
                    "@context": "https://schema.org",
                    "@type": "WebSite",
                    name: "SearchTern",
                    url: "https://searchtern.net",
                }],
            }} />
            <Landing />
        </>
    )
}

function App() {
    return (
        <BrowserRouter>
            <TrackerProvider>
                    <div>
                        <Navbar />
                        <ThemeNudge />
                        <ChangesNotice />
                        <div className="app-content">
                            <ErrorBoundary>
                            <Suspense fallback={null}>
                            <Routes>
                                <Route path="/" element={<HomeRoute />} />
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
                            </ErrorBoundary>
                        </div>
                        <AgentOverlay />
                        <SpeedInsights />
                        <Analytics />
                    </div>
                </TrackerProvider>
        </BrowserRouter>
    )
}

export default App