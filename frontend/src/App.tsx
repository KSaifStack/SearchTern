import { BrowserRouter, Routes, Route } from "react-router-dom"
import Navbar from "./components/Navbar"
import Home from "./pages/Home"
import Jobs from "./pages/Jobs"
import Tracker from "./pages/Tracker"
import { TrackerProvider } from "./components/TrackerContext"

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
                        </Routes>
                    </div>
                </div>
            </TrackerProvider>
        </BrowserRouter>
    )
}

export default App