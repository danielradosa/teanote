'use client'

import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/useAuthStore'

function DesktopNav() {
    const { signOut } = useAuthStore()
    const navigate = useNavigate()

    const handleLogout = async () => {
        await signOut()
        navigate('/login')
    }

    return (
        <header className="main-header">
            <div className="logo">
                <Link to="/">🍵 Teanote</Link>
            </div>
            <nav>
                <Link to="/brews">
                    <button className="btn btn-action">⏳ Start brew</button>
                </Link>
                <Link to="/journal">
                    <button className="btn btn-action">📔 Journal</button>
                </Link>
                <button className="btn btn-action" onClick={handleLogout}>
                    Log out
                </button>
            </nav>
        </header>
    )
}

export default DesktopNav