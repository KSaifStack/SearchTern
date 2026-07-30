import { useState, useRef, useEffect } from "react"
import "../styles/navbar.css"
import { Link, useLocation, useNavigate } from "react-router-dom"
import logo from "../assets/Logo.png"
import { useAuth } from "./AuthContext"
import { User, CaretDown, SignOut, SignIn, UserPlus, Info } from "@phosphor-icons/react"
import { notifications } from "@mantine/notifications"

function Navbar() {
    const [menuOpen, setMenuOpen] = useState(false)
    const [profileOpen, setProfileOpen] = useState(false)
    const location = useLocation()
    const navigate = useNavigate()
    const { user, signOut } = useAuth()
    const dropdownRef = useRef<HTMLDivElement>(null)

    // Google OAuth users store their info in user_metadata — fall back gracefully
    const displayEmail = user?.email ?? user?.user_metadata?.email ?? ''
    const displayName: string = user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? ''
    const avatarLetter = (displayName?.[0] ?? displayEmail?.[0] ?? '?').toUpperCase()

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setProfileOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

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
                
                {/* Mobile Auth Items */}
                <li className="mobile-auth-container">
                    {user ? (
                        <>
                            <div className="mobile-auth-header">
                                {displayName && (
                                    <span className="mobile-auth-name">{displayName}</span>
                                )}
                                <span className="mobile-auth-email">{displayEmail}</span>
                            </div>
                            <button
                                className="nav-profile-item"
                                onClick={() => {
                                    signOut();
                                    setMenuOpen(false);
                                    notifications.show({
                                        title: 'Signed Out',
                                        message: 'You have been successfully signed out.',
                                        color: 'blue',
                                        icon: <Info size={18} weight="bold" />
                                    });
                                }}
                            >
                                <SignOut weight="bold" />
                                <span>Log Out</span>
                            </button>
                        </>
                    ) : (
                            <>
                                <button
                                    className="nav-profile-item"
                                    onClick={() => { navigate('/auth'); setMenuOpen(false); }}
                                >
                                    <SignIn weight="bold" />
                                    <span>Log In</span>
                                </button>
                                <button
                                    className="nav-profile-item"
                                    onClick={() => { navigate('/auth?tab=signup'); setMenuOpen(false); }}
                                >
                                    <UserPlus weight="bold" />
                                    <span>Sign Up</span>
                                </button>
                            </>
                    )}
                </li>
            </ul>

            <div className="nav-auth" ref={dropdownRef}>
                <button
                    className="nav-profile-trigger"
                    onClick={() => setProfileOpen(!profileOpen)}
                >
                    {user ? (
                        <div className="nav-avatar" title={displayEmail}>
                            {avatarLetter}
                        </div>
                    ) : (
                        <div className="nav-avatar-placeholder">
                            <User weight="bold" />
                        </div>
                    )}
                    <CaretDown weight="bold" className={`nav-caret ${profileOpen ? 'open' : ''}`} />
                </button>

                {profileOpen && (
                    <div className="nav-profile-menu">
                        {user ? (
                            <>
                                <div className="nav-profile-header">
                                    {displayName && (
                                        <span className="nav-profile-name">{displayName}</span>
                                    )}
                                    <span className="nav-profile-email">{displayEmail}</span>
                                </div>
                                <div className="nav-profile-divider" />
                                <button
                                    className="nav-profile-item"
                                    onClick={() => {
                                        signOut();
                                        setProfileOpen(false);
                                        setMenuOpen(false);
                                        notifications.show({
                                            title: 'Signed Out',
                                            message: 'You have been successfully signed out.',
                                            color: 'blue',
                                            icon: <Info size={18} weight="bold" />
                                        });
                                    }}
                                >
                                    <SignOut weight="bold" />
                                    <span>Log Out</span>
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    className="nav-profile-item"
                                    onClick={() => { navigate('/auth'); setProfileOpen(false); setMenuOpen(false); }}
                                >
                                    <SignIn weight="bold" />
                                    <span>Log In</span>
                                </button>
                                <div className="nav-profile-divider" />
                                <button
                                    className="nav-profile-item"
                                    onClick={() => { navigate('/auth?tab=signup'); setProfileOpen(false); setMenuOpen(false); }}
                                >
                                    <UserPlus weight="bold" />
                                    <span>Sign Up</span>
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>
        </nav>
        </header>
    )
}

export default Navbar