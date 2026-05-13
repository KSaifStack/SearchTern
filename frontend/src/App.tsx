import { BrowserRouter, Routes, Route } from "react-router-dom"
import Navbar from "./components/Navbar"
import Home from "./pages/Home"
import Jobs from "./pages/Jobs"
import Tracker from "./pages/Tracker"

function App() {
    return (
        <BrowserRouter>
            <div>
                <Navbar />
                <main>
                    <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/jobs" element={<Jobs />} />
                        <Route path="/tracker" element={<Tracker />} />
                    </Routes>
                </main>
            </div>
        </BrowserRouter>
    )
}

export default App