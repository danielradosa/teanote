'use client'

function JournalPage() {
    return (
        <>
            <section className="page-wrap journal-page">
                <header className="page-header">
                    <h1>Journal</h1>
                    <p className="subtitle">Your recent tea sessions and stats 🍵</p>
                </header>

                <div className="journal-content">
                    <section className="recent-sessions">
                        <h2>Recent brews</h2>
                        <p>Oh 1. 2 and 3</p>
                    </section>

                    <section className="stats">
                        <h2>Stats</h2>
                        <p>CHART whatever</p>
                    </section>

                    <section className="quick-actions">
                        <h2>Quick actions</h2>
                        <div className="quick-action-btns">
                            <button className="btn btn-quick">start brew</button>
                            <button className="btn btn-quick">add tea</button>
                        </div>
                    </section>
                </div>
            </section>
        </>
    )
}

export default JournalPage