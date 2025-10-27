'use client'

function DesktopNav() {
    return (
        <>
            <header>
                <div className="logo">
                    <a href="/">🍵 teanote</a>
                </div>
                <nav>
                    <button className="btn btn-action">⏳ start brew</button>
                    <button className="btn btn-action">📔 journal</button>
                </nav>
            </header>
        </>
    )
}

export default DesktopNav