'use client'

function DesktopSidebar() {
    return (
        <>
            <aside className="sidebar">
                <a href="/" className="btn btn-sidebar">🏠 Home</a>
                <a href="/brews" className="btn btn-sidebar">⏱️ Brews</a>
                <a href="/teas" className="btn btn-sidebar">🍃 Teas</a>
                <a href="/journal" className="btn btn-sidebar">📔 Journal</a>
                <a href="/settings" className="btn btn-sidebar">⚙️ Settings</a>
            </aside>
        </>
    )
}

export default DesktopSidebar;