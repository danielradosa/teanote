'use client'

import { Link } from 'react-router-dom'

function DesktopSidebar() {
    return (
        <aside className="sidebar">
            <Link to="/" className="btn btn-sidebar">🏠 Home</Link>
            <Link to="/brews" className="btn btn-sidebar">⏱️ Brews</Link>
            <Link to="/teas" className="btn btn-sidebar">🍃 Teas</Link>
            <Link to="/journal" className="btn btn-sidebar">📔 Journal</Link>
            <Link to="/settings" className="btn btn-sidebar">⚙️ Settings</Link>
            <Link to="/account" className="btn btn-sidebar">👨🏻‍🔧 Account</Link>
        </aside>
    )
}

export default DesktopSidebar