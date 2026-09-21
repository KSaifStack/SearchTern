import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { SpeedInsights } from "@vercel/speed-insights/react"
import { Analytics } from "@vercel/analytics/react"
import Navbar from "./components/Navbar"
import Home from "./pages/Home"
import Jobs from "./pages/Jobs"
import JobDetail from "./pages/JobDetail"
import Tracker from "./pages/Tracker"
import Auth from "./pages/Auth"
import Privacy from "./pages/Privacy"
import Settings from "./pages/Settings"
import { TrackerProvider } from "./components/TrackerContext"
import { AuthProvider } from "./components/AuthContext"
import { AgentOverlay } from "./components/AgentOverlay"
import { usePageMeta } from "./utils/seo"
import type { PageMeta } from "./utils/seo"

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

function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <TrackerProvider>
                    <div>
                        <Navbar />
                        <div className="app-content">
                            <Routes>
                                <Route
                                    path="/"
                                    element={
                                        <>
                                            <RouteMeta meta={{
                                                title: "SearchTern",
                                                description: "SearchTern finds and tracks thousands of active software engineering internships and new-grad roles. Search by company, role, or location, and manage every application in one tracker.",
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