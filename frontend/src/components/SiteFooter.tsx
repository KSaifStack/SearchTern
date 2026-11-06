import { Link } from "react-router-dom"
import "../styles/SiteFooter.css"

function SiteFooter() {
    return (
        <footer className="site-footer">
            <div className="site-footer-inner">
                <span className="site-footer-text">© 2026 SearchTern</span>
                <nav className="site-footer-nav">
                    <a href="https://github.com/KSaifStack/SearchTern" target="_blank" rel="noopener noreferrer">
                        GitHub
                    </a>
                    <Link to="/privacy">Privacy Policy</Link>
                </nav>
            </div>
        </footer>
    )
}

export default SiteFooter
