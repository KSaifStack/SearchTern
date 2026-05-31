import { BrowserRouter, Routes, Route } from "react-router-dom"
import { SpeedInsights } from "@vercel/speed-insights/react"
import Navbar from "./components/Navbar"
import Home from "./pages/Home"
import Jobs from "./pages/Jobs"
import Tracker from "./pages/Tracker"
import { TrackerProvider } from "./components/TrackerContext"
import RegistrationForm from "./pages/Registrationform"

function App() {
    return (
        <BrowserRouter>
            <TrackerProvider>
                <div>
                    <Navbar />
                    <div className="app-content">
                        <Routes>
                            <Route path="/" element={<Home />} />
                            <Route path="/jobs" element={<main className="standard-layout"><Jobs /></main>} />
                            <Route path="/tracker" element={<main className="full-width-layout"><Tracker /></main>} />
                            <Route path="/register" element={<main className="RegistrationForm"><RegistrationForm /></main>} />
                        </Routes>
                    </div>
                    <SpeedInsights />
                </div>
            </TrackerProvider>
        </BrowserRouter>
    )
}

export default App