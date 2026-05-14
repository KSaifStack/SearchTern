import "../styles/navbar.css"
import { Link } from "react-router-dom"
import logo from "../assets/Logo.png"

function Navbar() {
    return (
        <header>
        <nav>
            <ul className="Logo">
            <h1><Link to ="/">Search<span className="accent">Tern</span></Link></h1>
            <img src={logo} alt="Logo" height="55"></img>
            </ul>
            <ul className="nav-left">
                <li><Link to = "/jobs">Job-Finder</Link></li>
                <li><Link to = "/tracker">Job-Tracker</Link></li>
            </ul>
            <ul className="nav-right">
                <li><Link to ="/signup">Sign-up</Link></li>
            </ul>
        </nav>
        </header>
    )
}

export default Navbar