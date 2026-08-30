import { BrowserRouter, Routes, Route } from "react-router-dom"
import { SpeedInsights } from "@vercel/speed-insights/react"
import { Analytics } from "@vercel/analytics/react"
import Navbar from "./components/Navbar"
import Home from "./pages/Home"
import Jobs from "./pages/Jobs"
import Tracker from "./pages/Tracker"
import Auth from "./pages/Auth"
import Privacy from "./pages/Privacy"
import Settings from "./pages/Settings"
import { TrackerProvider } from "./components/TrackerContext"
import { AuthProvider } from "./components/AuthContext"

function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <TrackerProvider>
                    <div>
                        <Navbar />
                        <div className="app-content">
                            <Routes>
                                <Route path="/" element={<Home />} />
                                <Route path="/jobs" element={<main className="standard-layout"><Jobs /></main>} />
                                <Route path="/tracker" element={<main className="full-width-layout"><Tracker /></main>} />
                                <Route path="/auth" element={<main className="auth-wrapper"><Auth /></main>} />
                                <Route path="/privacy" element={<main className="standard-layout"><Privacy /></main>} />
                                <Route path="/settings" element={<main className="standard-layout"><Settings /></main>} />
                            </Routes>
                        </div>
                        <SpeedInsights />
                        <Analytics />
                    </div>
                </TrackerProvider>
            </AuthProvider>
        </BrowserRouter>
    )
}

export default App