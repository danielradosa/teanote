'use client'

import { Link} from 'react-router-dom'

function DesktopNavDummy() {

    return (
        <header className="main-header">
            <div className="logo">
                <Link to="/">&nbsp;</Link>
            </div>
            <nav>
                <Link to="/brews">
                    &nbsp;
                </Link>
                <Link to="/journal">
                    &nbsp;
                </Link>
                <button className="btn btn-action">
                    &nbsp;
                </button>
            </nav>
        </header>
    )
}

export default DesktopNavDummy