import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'

import AppInitializer from '@/AppInitializer'
import ProtectedRoute from '@/components/ProtectedRoute'
import PublicRoute from '@/components/PublicRoute'
import App from '@/App'
import Loader from '@/components/Loader'

import '@/styles/index.css'
import '@/lang'

const DashboardPage = lazy(() => import('@/pages/DashboardPage'))
const BrewPage = lazy(() => import('@/pages/BrewPage'))
const JournalPage = lazy(() => import('@/pages/JournalPage'))
const TeaProfilesPage = lazy(() => import('@/pages/TeaProfilesPage'))
const SettingsPage = lazy(() => import('@/pages/SettingsPage'))
const AccountPage = lazy(() => import('@/pages/AccountPage'))
const LoginPage = lazy(() => import('@/pages/LoginPage'))
const SignupPage = lazy(() => import('@/pages/SignupPage'))

const pageFallback = (
  <div style={{ minHeight: '50dvh', display: 'grid', placeItems: 'center' }}>
    <Loader />
  </div>
)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppInitializer>
        <Suspense fallback={pageFallback}>
          <Routes>
            <Route path="/" element={<ProtectedRoute><App /></ProtectedRoute>}>
              <Route index element={<DashboardPage />} />
              <Route path="brews" element={<BrewPage />} />
              <Route path="journal" element={<JournalPage />} />
              <Route path="teas" element={<TeaProfilesPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="account" element={<AccountPage />} />
            </Route>

            <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
            <Route path="/signup" element={<PublicRoute><SignupPage /></PublicRoute>} />

            <Route path="*" element={<ProtectedRoute><App /></ProtectedRoute>} />
          </Routes>
        </Suspense>
      </AppInitializer>
    </BrowserRouter>
  </React.StrictMode>
)
