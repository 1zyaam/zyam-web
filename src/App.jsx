import { useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import TopBar from './components/TopBar.jsx'
import Landing from './pages/Landing.jsx'
import SignupWizard from './pages/SignupWizard.jsx'
import Auth from './pages/Auth.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Storefront from './pages/Storefront.jsx'
import Admin from './pages/Admin.jsx'

export default function App() {
  const location = useLocation()

  // Dark mode: persisted choice, default light (the admin panel owns its own theme)
  useEffect(() => {
    if (location.pathname === '/admin') return
    const saved = localStorage.getItem('zyamweb-theme')
    if (saved === 'dark') document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
  }, [location.pathname])

  const isStorefront = location.pathname.startsWith('/s/')
  const isAdmin = location.pathname === '/admin'

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 to-[#E9E2FF] dark:from-night-bg1 dark:to-night-bg2 text-ink dark:text-white transition-colors">
      {!isStorefront && !isAdmin && <TopBar />}
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/signup" element={<SignupWizard />} />
        <Route path="/login" element={<Auth />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/s/:slug" element={<Storefront />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<Landing />} />
      </Routes>
    </div>
  )
}
