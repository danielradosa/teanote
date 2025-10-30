'use client'

function DesktopSidebar() {
    return (
        <>
            <aside className="sidebar">
                <a href="/" className="btn btn-sidebar">🏠 home</a>
                <a href="/brews" className="btn btn-sidebar">⏱️ brews</a>
                <a href="/teas" className="btn btn-sidebar">🍃 teas</a>
                <a href="/journal" className="btn btn-sidebar">📔 journal</a>
                <a href="/settings" className="btn btn-sidebar">⚙️ settings</a>
            </aside>
        </>
    )
}

export default DesktopSidebar;