// App.tsx
import { Outlet } from 'react-router-dom'
import DesktopNav from './components/layout/DesktopNav'
import DesktopSidebar from './components/layout/DesktopSidebar'
import { Toaster } from 'react-hot-toast'
import ThemeManager from './components/layout/ThemeManager'

export default function App() {
    return (
        <div className="app">
            <DesktopNav />
            <div className="layout">
                <DesktopSidebar />
                <main>
                    <Outlet />
                </main>
            </div>
            <Toaster />
            <ThemeManager />
        </div>
    )
}