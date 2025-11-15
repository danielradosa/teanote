import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'

import AppInitializer from './AppInitializer'
import ProtectedRoute from './components/ProtectedRoute'
import PublicRoute from './components/PublicRoute'
import App from './App'

import DashboardPage from './pages/DashboardPage'
import BrewPage from './pages/BrewPage'
import JournalPage from './pages/JournalPage'
import TeaProfilesPage from './pages/TeaProfilesPage'
import SettingsPage from './pages/SettingsPage'
import AccountPage from './pages/AccountPage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'

import './styles/index.css'
import "./lang"

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppInitializer>
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
      </AppInitializer>
    </BrowserRouter>
  </React.StrictMode>
)