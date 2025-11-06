import { Outlet } from 'react-router-dom'
import { useAuthStore } from './stores/useAuthStore'
import DesktopNav from './components/layout/DesktopNav'
import DesktopSidebar from './components/layout/DesktopSidebar'
import { Toaster } from 'react-hot-toast'
import { MoonLoader } from 'react-spinners'

export default function App() {
    const { access, initialized } = useAuthStore()

    const spinner = (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100%',
            width: '100%',
            position: 'absolute',
            left: 0,
            top: 0
        }}>
            <MoonLoader size={30} color="#202121" />
        </div>
    )

    return (
        <div className="app">
            <DesktopNav />
            <div className="layout">
                <DesktopSidebar />
                <main>
                    {!initialized ? (
                        spinner
                    ) : access === 'unknown' ? (
                        spinner
                    ) : access === 'denied' ? (
                        <div>
                            <h2>Your trial has expired</h2>
                            <p>Please subscribe to continue.</p>
                        </div>
                    ) : (
                        <Outlet />
                    )}
                </main>
            </div>
            <Toaster />
        </div>
    )
}