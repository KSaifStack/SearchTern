import "../styles/navbar.css"
import { Link } from "react-router-dom"
import logo from "../assets/Logo.png"

function Navbar() {
    return (
        <header>
        <nav>
            <h1><Link to ="/">Search<span className="accent">Tern</span><img src={logo} alt="Logo" height="55" /></Link></h1>
            <ul className="nav-left">
                <li><Link to = "/jobs">Job-Finder</Link></li>
                <li><Link to = "/tracker">Job-Tracker</Link></li>
            </ul>
            <ul className="nav-right">
                <li><Link to ="/login">Login</Link></li>
                <li><Link to ="/signup">Sign-up</Link></li>
            </ul>
        </nav>
        </header>
    )
}

export default Navbar