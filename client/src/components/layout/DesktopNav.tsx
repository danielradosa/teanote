'use client'

function DesktopNav() {
    return (
        <>
            <header className="main-header">
                <div className="logo">
                    <a href="/">🍵 Teanote</a>
                </div>
                <nav>
                    <button className="btn btn-action">⏳ Start brew</button>
                    <button className="btn btn-action">📔 Journal</button>
                </nav>
            </header>
        </>
    )
}

export default DesktopNav