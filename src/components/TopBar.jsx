import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Logo from './Logo.jsx'

const NAV_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/#pricing', label: 'Pricing' },
  { to: '/#features', label: 'Features' },
  { to: '/login', label: 'Login' },
  { to: '/signup', label: 'Sign up' },
]

function applyTheme(next) {
  document.documentElement.classList.toggle('dark', next === 'dark')
  localStorage.setItem('zyamweb-theme', next)
}

/**
 * Sticky floating pill top bar (Vessa style).
 * Logo left, nav links centre, theme toggle + actions right.
 * Theme toggle switches the WHOLE site to dark mode and persists it
 * in localStorage under 'zyamweb-theme'. Uses a circular wipe via the
 * View Transitions API when available, with a smooth fallback.
 * Triple-tap on the Logo navigates to /admin. No CEO/Owner tab anywhere.
 * Mobile: a bottom bar with Home / Create / Log in / Theme only.
 */
export default function TopBar() {
  const navigate = useNavigate()
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'light'
    return localStorage.getItem('zyamweb-theme') === 'dark' ? 'dark' : 'light'
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  function toggleTheme(event) {
    const next = theme === 'dark' ? 'light' : 'dark'
    const x = event?.clientX ?? window.innerWidth / 2
    const y = event?.clientY ?? window.innerHeight / 2
    const root = document.documentElement
    root.style.setProperty('--wipe-x', `${x}px`)
    root.style.setProperty('--wipe-y', `${y}px`)

    if (document.startViewTransition) {
      document.startViewTransition(() => applyTheme(next))
    } else {
      applyTheme(next)
    }
    setTheme(next)
  }

  const isDark = theme === 'dark'

  return (
    <>
      <header className="sticky top-3 z-50 px-3 pt-1 sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 rounded-full bg-white/80 px-3 py-2 shadow-pill ring-1 ring-brand-200/60 backdrop-blur-md dark:bg-night-card/80 dark:ring-night-border">
          <Logo onTripleTap={() => navigate('/admin')} />

          <nav aria-label="Main navigation" className="hidden items-center gap-1 md:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.label}
                to={link.to}
                className="rounded-full px-3 py-1.5 text-sm font-medium text-ink/80 transition-colors hover:bg-brand-100 hover:text-brand-700 dark:text-white/80 dark:hover:bg-night-border dark:hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-brand-700 transition-colors hover:bg-brand-200 dark:bg-night-border dark:text-white dark:hover:bg-brand-700"
            >
              {isDark ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
                  <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                </svg>
              )}
            </button>
            <Link
              to="/login"
              className="hidden rounded-full px-3 py-2 text-sm font-medium text-ink/80 hover:text-brand-700 dark:text-white/80 dark:hover:text-white sm:block"
            >
              Log in
            </Link>
            <Link
              to="/signup"
              className="rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-pill transition-colors hover:bg-brand-700"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* Mobile bottom bar: Home / Create / Log in / Theme only — no CEO/Owner tab. */}
      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-3 bottom-3 z-50 flex items-center justify-around rounded-full bg-white/90 px-2 py-2 shadow-pill ring-1 ring-brand-200/60 backdrop-blur-md dark:bg-night-card/90 dark:ring-night-border md:hidden"
      >
        <Link to="/" className="flex flex-col items-center gap-0.5 rounded-full px-3 py-1 text-xs font-medium text-ink dark:text-white">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          Home
        </Link>
        <Link to="/signup" className="flex flex-col items-center gap-0.5 rounded-full px-3 py-1 text-xs font-medium text-ink dark:text-white">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Create
        </Link>
        <Link to="/login" className="flex flex-col items-center gap-0.5 rounded-full px-3 py-1 text-xs font-medium text-ink dark:text-white">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
            <polyline points="10 17 15 12 10 7" />
            <line x1="15" x2="3" y1="12" y2="12" />
          </svg>
          Log in
        </Link>
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          className="flex flex-col items-center gap-0.5 rounded-full px-3 py-1 text-xs font-medium text-ink dark:text-white"
        >
          {isDark ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
              <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
            </svg>
          )}
          Theme
        </button>
      </nav>
    </>
  )
}
