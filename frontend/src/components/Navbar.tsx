import { useState } from "react"
import "../styles/navbar.css"
import { Link, useLocation } from "react-router-dom"
import logo from "../assets/Logo.png"

function Navbar() {
    const [menuOpen, setMenuOpen] = useState(false)
    const location = useLocation()

    return (
        <header>
        <nav>
            <ul className="Logo">
            <h1><Link to ="/" onClick={() => setMenuOpen(false)}>Search<span className="accent">Tern</span></Link></h1>
            <img src={logo} alt="Logo" height="55"></img>
            </ul>

            <button
                className={`nav-hamburger${menuOpen ? ' open' : ''}`}
                onClick={() => setMenuOpen(o => !o)}
                aria-label="Toggle menu"
                aria-expanded={menuOpen}
            >
                <span /><span /><span />
            </button>

            <ul className={`nav-left${menuOpen ? ' open' : ''}`}>
                <li><Link to="/jobs" className={location.pathname === '/jobs' ? 'active' : ''} onClick={() => setMenuOpen(false)}>Internships</Link></li>
                <li><Link to="/tracker" className={location.pathname === '/tracker' ? 'active' : ''} onClick={() => setMenuOpen(false)}>Applications</Link></li>
            </ul>
        </nav>
        </header>
    )
}

export default Navbar