import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { PLANS, THEMES, daysSince, timeAgo, FREEZE_DAYS } from '../lib/store.js'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'ads', label: 'Ads' },
  { id: 'support', label: 'Support' }
]

const STATUS_STYLES = {
  pending: 'bg-vessa-copper/10 text-vessa-copper dark:bg-vessa-peach/15 dark:text-vessa-peach',
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  frozen: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  rejected: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  banned: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
}

function StatusPill({ status }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[status] || STATUS_STYLES.pending}`}>
      {status}
    </span>
  )
}



/* ---------- Vessa-style helpers (copper accent, greige/dark shell) ---------- */

function useAdminTheme() {
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'dark'
    return localStorage.getItem('zyamweb-admin-theme') || 'dark'
  })
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('zyamweb-admin-theme', theme)
  }, [theme])
  function toggleTheme(event) {
    const next = theme === 'dark' ? 'light' : 'dark'
    const x = event?.clientX ?? window.innerWidth / 2
    const y = event?.clientY ?? window.innerHeight / 2
    const root = document.documentElement
    root.style.setProperty('--wipe-x', `${x}px`)
    root.style.setProperty('--wipe-y', `${y}px`)
    if (document.startViewTransition) {
      document.startViewTransition(() => {
        document.documentElement.classList.toggle('dark', next === 'dark')
        setTheme(next)
      })
    } else {
      setTheme(next)
    }
  }
  return { theme, toggleTheme }
}

function CountUp({ value, prefix = '', suffix = '' }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    let raf
    const start = performance.now()
    const dur = 1100
    const tick = (t) => {
      const p = Math.min(1, (t - start) / dur)
      setN(Math.round(value * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value])
  return <span>{prefix}{n.toLocaleString()}{suffix}</span>
}

function Sparkline({ data, stroke = '#A8481C', className = '' }) {
  if (!data || data.length < 2) return null
  const w = 96
  const h = 32
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${h - 3 - ((v - min) / (max - min || 1)) * (h - 6)}`)
    .join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} aria-hidden="true">
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Gauge({ percent, center, label }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(t)
  }, [])
  const total = 48
  const p = Math.max(0, Math.min(100, percent))
  const filled = mounted ? Math.round((p / 100) * total) : 0
  const ticks = Array.from({ length: total }, (_, i) => {
    const a = Math.PI - (i / (total - 1)) * Math.PI
    const x1 = 100 + Math.cos(a) * 62
    const y1 = 96 - Math.sin(a) * 62
    const x2 = 100 + Math.cos(a) * 78
    const y2 = 96 - Math.sin(a) * 78
    const on = i < filled
    return (
      <line
        key={i}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        strokeWidth="3"
        strokeLinecap="round"
        className={on ? 'stroke-vessa-copper dark:stroke-vessa-peach' : 'stroke-black/10 dark:stroke-white/10'}
        style={{ transition: 'stroke 0.35s ease', transitionDelay: `${i * 12}ms` }}
      />
    )
  })
  return (
    <div className="relative mx-auto w-52">
      <svg viewBox="0 0 200 108" className="w-full">
        {ticks}
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center">
        <p className="text-3xl font-bold leading-none">{center}</p>
        <p className="mt-1 text-xs text-[#56615a] dark:text-[#a8b4ad]">{label}</p>
      </div>
    </div>
  )
}

function SignupChart({ data }) {
  const [hidden, setHidden] = useState({})
  const [hover, setHover] = useState(null)
  const series = [
    { key: 'newCount', label: 'New accounts', dot: 'bg-vessa-teal dark:bg-vessa-tealLight', bar: 'bg-vessa-teal dark:bg-vessa-tealLight' },
    { key: 'approvedCount', label: 'Approved', dot: 'bg-vessa-copper dark:bg-vessa-peach', bar: 'bg-vessa-copper dark:bg-vessa-peach' },
    { key: 'totalCount', label: 'Total accounts', dot: 'bg-vessa-sky dark:bg-vessa-skyLight', bar: 'bg-vessa-sky dark:bg-vessa-skyLight' }
  ]
  const visible = series.filter((s) => !hidden[s.key])
  const max = Math.max(...data.flatMap((d) => visible.map((s) => d[s.key])), 1)
  const toggle = (key) => setHidden((h) => ({ ...h, [key]: !h[key] }))
  const stripe = { backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.16) 0 2px, transparent 2px 7px)' }
  return (
    <div>
      <div className="flex flex-wrap gap-1">
        {series.map((s) => (
          <button
            key={s.key}
            onClick={() => toggle(s.key)}
            aria-pressed={!hidden[s.key]}
            className={`flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold transition-opacity ${hidden[s.key] ? 'text-[#56615a] opacity-45 dark:text-[#a8b4ad]' : 'text-[#18201b] hover:bg-black/[0.03] dark:text-white dark:hover:bg-white/5'}`}
          >
            <span className={`h-2.5 w-2.5 rounded-full ${s.dot}`} />
            {s.label}
          </button>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <div className="flex h-44 w-6 shrink-0 flex-col justify-between text-right text-[11px] leading-none text-[#56615a] dark:text-[#88948d]">
          <span>{max}</span>
          <span>{Math.round(max / 2)}</span>
          <span>0</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="relative">
            <div aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-black/[0.06] dark:bg-white/10" />
            <div aria-hidden="true" className="absolute inset-x-0 top-1/2 h-px bg-black/[0.06] dark:bg-white/10" />
            <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-px bg-black/[0.06] dark:bg-white/10" />
            <div className="relative flex h-44 items-end gap-2">
              {data.map((d, i) => (
                <div
                  key={d.label}
                  className="group relative flex h-full flex-1 items-end justify-center gap-[3px]"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                >
                  {hover === i && (
                    <div className="absolute -top-1 left-1/2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-xl bg-[#18201b] px-3 py-2 text-xs text-white shadow-xl dark:bg-white dark:text-[#18201b]">
                      <p className="font-bold">{d.label}</p>
                      {series.map((s) => (
                        <p key={s.key} className="flex items-center gap-1.5">
                          <span className={`h-2 w-2 rounded-full ${s.dot}`} />
                          {s.label}: <strong>{d[s.key]}</strong>
                        </p>
                      ))}
                    </div>
                  )}
                  {visible.map((s) => (
                    <div
                      key={s.key}
                      className={`w-full max-w-[16px] origin-bottom rounded-t-[4px] ${s.bar}`}
                      style={{
                        height: `${Math.max(3, (d[s.key] / max) * 100)}%`,
                        animation: 'vessa-bar 0.7s cubic-bezier(0.22,1,0.36,1) backwards',
                        animationDelay: `${i * 50}ms`,
                        ...stripe
                      }}
                    />
                  ))}
                  {visible.length === 0 && <div className="h-[3px] w-full max-w-[16px] rounded bg-black/10 dark:bg-white/10" />}
                </div>
              ))}
            </div>
          </div>
          <div className="mt-2 flex gap-2">
            {data.map((d) => (
              <span key={d.label} className="flex-1 text-center text-[11px] text-[#56615a] dark:text-[#88948d]">{d.label}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------- Icons (inline SVG, lucide-style) ---------- */
function SvgIcon({ d, className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {d}
    </svg>
  )
}
function IGrid({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect width="7" height="9" x="3" y="3" rx="1" />
      <rect width="7" height="5" x="14" y="3" rx="1" />
      <rect width="7" height="9" x="14" y="12" rx="1" />
      <rect width="7" height="5" x="3" y="16" rx="1" />
    </svg>
  )
}
function IUsers({ className }) {
  return <SvgIcon className={className} d={<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>} />
}
function IMegaphone({ className }) {
  return <SvgIcon className={className} d={<><path d="m3 11 18-5v12L3 14v-3z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" /></>} />
}
function IChat({ className }) {
  return <SvgIcon className={className} d={<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />} />
}
function ISearch({ className }) {
  return <SvgIcon className={className} d={<><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></>} />
}
function IBell({ className }) {
  return <SvgIcon className={className} d={<><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></>} />
}
function ISun({ className }) {
  return <SvgIcon className={className} d={<><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></>} />
}
function IMoon({ className }) {
  return <SvgIcon className={className} d={<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />} />
}
function IPlus({ className }) {
  return <SvgIcon className={className} d={<path d="M12 5v14M5 12h14" />} />
}
function IRefresh({ className }) {
  return <SvgIcon className={className} d={<><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></>} />
}
function ILogout({ className }) {
  return <SvgIcon className={className} d={<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" /></>} />
}
function IChevron({ className }) {
  return <SvgIcon className={className} d={<polyline points="6 9 12 15 18 9" />} />
}
function ICollapse({ className }) {
  return <SvgIcon className={className} d={<><polyline points="11 17 6 12 11 7" /><polyline points="18 17 13 12 18 7" /></>} />
}
function IPackage({ className }) {
  return <SvgIcon className={className} d={<><path d="m7.5 4.27 9 5.15" /><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></>} />
}
function IAlert({ className }) {
  return <SvgIcon className={className} d={<><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></>} />
}
function IExternal({ className }) {
  return <SvgIcon className={className} d={<><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></>} />
}

const TAB_ICONS = { overview: IGrid, accounts: IUsers, ads: IMegaphone, support: IChat }

/* ---------- Vessa sidebar (own rounded card, sliding active pill) ---------- */
function AdminSidebar({ activeTab, onSelect, pending, openMessages, collapsed, onToggleCollapse, theme, onToggleTheme, onLogout }) {
  const navRef = useRef(null)
  const [pill, setPill] = useState({ top: 0, height: 0, show: false })
  useEffect(() => {
    const el = navRef.current?.querySelector(`[data-tab="${activeTab}"]`)
    if (el) setPill({ top: el.offsetTop, height: el.offsetHeight, show: true })
  }, [activeTab, collapsed])
  const badges = { accounts: pending, support: openMessages }
  return (
    <aside className={`sticky top-[112px] hidden h-[calc(100vh-128px)] shrink-0 flex-col gap-4 self-start md:flex ${collapsed ? 'w-[76px]' : 'w-[216px]'}`}>
      <div className="rounded-[22px] bg-vessa-card p-3 shadow-[0_1px_2px_rgba(20,36,28,0.04),0_14px_34px_-22px_rgba(20,36,28,0.28)] ring-1 ring-black/5 dark:bg-vessa-darkCard dark:ring-white/5 dark:shadow-[0_18px_40px_-26px_rgba(0,0,0,0.85)]">
      {collapsed ? (
        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-black/[0.05] text-[#18201b]/70 hover:bg-black/[0.08] dark:bg-white/10 dark:text-white/70 dark:hover:bg-white/15"
        >
          {theme === 'dark' ? <ISun className="h-4 w-4" /> : <IMoon className="h-4 w-4" />}
        </button>
      ) : (
        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="relative flex h-9 items-center justify-between rounded-full bg-black/[0.05] px-1 dark:bg-white/10"
        >
          <span className="relative z-10 flex h-7 w-7 items-center justify-center text-[#18201b]/70 dark:text-[#a8b4ad]"><ISun className="h-4 w-4" /></span>
          <span className="relative z-10 flex h-7 w-7 items-center justify-center text-[#18201b]/70 dark:text-[#a8b4ad]"><IMoon className="h-4 w-4" /></span>
          <span aria-hidden="true" className={`absolute top-1 h-7 w-7 rounded-full bg-vessa-card shadow transition-all duration-300 dark:bg-vessa-darkCard ${theme === 'dark' ? 'right-1' : 'left-1'}`} />
        </button>
      )}

      <nav ref={navRef} className="relative mt-2 flex flex-col gap-1" aria-label="Admin sections">
        <span
          aria-hidden="true"
          className="absolute left-0 w-full rounded-full bg-vessa-copper transition-all duration-300 dark:bg-vessa-peach"
          style={{ top: pill.top, height: pill.height, opacity: pill.show ? 1 : 0 }}
        />
        {TABS.map((tab) => {
          const Icon = TAB_ICONS[tab.id]
          const active = activeTab === tab.id
          const badge = badges[tab.id] || 0
          return (
            <button
              key={tab.id}
              data-tab={tab.id}
              onClick={() => onSelect(tab.id)}
              aria-current={active ? 'page' : undefined}
              title={collapsed ? tab.label : undefined}
              className={`relative z-10 flex items-center gap-3 rounded-full px-3.5 py-2.5 text-sm font-semibold transition-colors ${active ? 'text-white dark:text-[#2b0f03]' : 'text-[#18201b]/75 hover:bg-black/[0.04] dark:text-white/75 dark:hover:bg-white/5'} ${collapsed ? 'justify-center px-0' : ''}`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span className="flex-1 text-left">{tab.label}</span>}
              {!collapsed && badge > 0 && (
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${active ? 'bg-white/25 text-white dark:bg-black/15 dark:text-[#2b0f03]' : 'bg-vessa-copper/10 text-vessa-copper dark:bg-vessa-peach/15 dark:text-vessa-peach'}`}>
                  {badge}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      </div>
      <div className="mt-auto flex flex-col gap-1 rounded-[22px] bg-vessa-card p-1.5 shadow-[0_1px_2px_rgba(20,36,28,0.04),0_14px_34px_-22px_rgba(20,36,28,0.28)] ring-1 ring-black/5 dark:bg-vessa-darkCard dark:ring-white/5 dark:shadow-[0_18px_40px_-26px_rgba(0,0,0,0.85)]">
        <Link
          to="/"
          title={collapsed ? 'View public site' : undefined}
          className={`flex items-center gap-3 rounded-full px-3.5 py-2.5 text-sm font-medium text-[#18201b]/70 hover:bg-black/[0.04] dark:text-white/70 dark:hover:bg-white/5 ${collapsed ? 'justify-center px-0' : ''}`}
        >
          <IExternal className="h-5 w-5 shrink-0" />
          {!collapsed && <span>View site</span>}
        </Link>
        <button
          type="button"
          onClick={onLogout}
          title={collapsed ? 'Log out' : undefined}
          className={`flex items-center gap-3 rounded-full px-3.5 py-2.5 text-sm font-medium text-[#18201b]/70 hover:bg-black/[0.04] dark:text-white/70 dark:hover:bg-white/5 ${collapsed ? 'justify-center px-0' : ''}`}
        >
          <ILogout className="h-5 w-5 shrink-0" />
          {!collapsed && <span>Log out</span>}
        </button>
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand' : 'Collapse'}
          className={`flex items-center gap-3 rounded-full px-3.5 py-2 text-xs font-medium text-[#56615a] hover:bg-black/[0.04] dark:text-[#88948d] dark:hover:bg-white/5 ${collapsed ? 'justify-center px-0' : ''}`}
        >
          <ICollapse className={`h-4 w-4 shrink-0 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} />
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  )
}

/* ---------- Vessa top bar (floating rounded pill) ---------- */
const ICON_BTN = 'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#18201b]/70 hover:bg-black/[0.04] dark:text-white/70 dark:hover:bg-white/5'
const MENU_ITEM = 'block w-full rounded-xl px-3 py-2 text-left text-sm font-medium hover:bg-black/[0.04] dark:hover:bg-white/5'

function AdminTopBar({ activeTab, onSelect, onOpenPalette, onRefresh, bellCount, bellOpen, onToggleBell, alerts, onAlertClick, onNew, adminEmail, accountOpen, onToggleAccount, onLogout }) {
  const navigate = useNavigate()
  return (
    <header className="sticky top-4 z-40 flex h-20 items-center gap-2 rounded-full bg-vessa-card/90 px-4 shadow-[0_1px_2px_rgba(20,36,28,0.04),0_14px_34px_-22px_rgba(20,36,28,0.28)] ring-1 ring-black/5 backdrop-blur-md dark:bg-vessa-darkCard/90 dark:ring-white/5 dark:shadow-[0_18px_40px_-26px_rgba(0,0,0,0.85)]">
      <div className="flex min-w-0 items-center gap-2.5">
        <button
          type="button"
          onClick={() => navigate('/')}
          aria-label="Zyam Web — home"
          title="Back to home"
          className="logo-mark-copper h-10 w-10 shrink-0 overflow-hidden rounded-[10px] ring-1 ring-white/20 focus-visible:outline-none"
        >
          <img src="/logo-mark.png" alt="Zyam Web logo" className="h-full w-full object-cover" />
        </button>
        <span className="hidden leading-tight sm:block">
          <span className="block text-sm font-bold tracking-wide">ZYAM WEB</span>
          <span className="block text-[11px] text-[#56615a] dark:text-[#a8b4ad]">Owner console</span>
        </span>
      </div>

      <nav className="mx-auto hidden items-center gap-1 rounded-full bg-black/[0.04] p-1 dark:bg-white/5 lg:flex" aria-label="Admin sections">
        {TABS.map((tab) => {
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => onSelect(tab.id)}
              aria-current={active ? 'page' : undefined}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${active ? 'bg-[#18201b] text-white dark:bg-white dark:text-[#0f1412]' : 'text-[#18201b]/70 hover:bg-black/[0.04] dark:text-white/70 dark:hover:bg-white/5'}`}
            >
              {tab.label}
            </button>
          )
        })}
      </nav>

      <div className="ml-auto flex items-center gap-1.5 lg:ml-0">
        <button
          type="button"
          onClick={onOpenPalette}
          className="hidden items-center gap-2 rounded-full bg-black/[0.04] px-3 py-2 text-sm text-[#56615a] hover:bg-black/[0.07] dark:bg-white/5 dark:text-[#a8b4ad] dark:hover:bg-white/10 sm:flex"
        >
          <ISearch className="h-4 w-4" />
          <span className="hidden lg:inline">Search</span>
          <kbd className="rounded-md bg-black/10 px-1.5 py-0.5 text-[10px] font-bold dark:bg-white/15">⌘K</kbd>
        </button>
        <button type="button" onClick={onRefresh} aria-label="Refresh" title="Refresh" className={ICON_BTN}>
          <IRefresh className="h-5 w-5" />
        </button>
        <div className="relative">
          <button type="button" onClick={onToggleBell} aria-label="Notifications" title="Notifications" className={`${ICON_BTN} relative`}>
            <IBell className="h-5 w-5" />
            {bellCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{bellCount}</span>
            )}
          </button>
          {bellOpen && (
            <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-[22px] bg-vessa-card p-2 shadow-xl ring-1 ring-black/5 dark:bg-vessa-darkCard dark:ring-white/10">
              <p className="px-2 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-[#56615a] dark:text-[#88948d]">Alerts</p>
              {alerts.length === 0 ? (
                <p className="px-2 py-3 text-sm text-[#56615a] dark:text-[#a8b4ad]">All clear — nothing needs you.</p>
              ) : (
                alerts.map((a) => (
                  <button key={a.key} onClick={() => onAlertClick(a)} className="flex w-full items-start gap-2.5 rounded-2xl px-2 py-2 text-left hover:bg-black/[0.04] dark:hover:bg-white/5">
                    <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${a.tone}`} />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">{a.title}</span>
                      <span className="block text-xs text-[#56615a] dark:text-[#a8b4ad]">{a.sub}</span>
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onNew}
          className="hidden items-center gap-1.5 rounded-full bg-vessa-copper px-4 py-2 text-sm font-semibold text-white hover:bg-vessa-copperDark dark:bg-vessa-peach dark:text-[#2b0f03] dark:hover:bg-vessa-peachLight sm:flex"
        >
          <IPlus className="h-4 w-4" /> New
        </button>
        <div className="relative">
          <button type="button" onClick={onToggleAccount} className="flex items-center gap-2 rounded-full py-1 pl-1 pr-1.5 hover:bg-black/[0.04] dark:hover:bg-white/5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-vessa-peach text-xs font-bold text-[#2b0f03]">WA</span>
            <span className="hidden text-left leading-tight lg:block">
              <span className="block text-[11px] text-[#56615a] dark:text-[#a8b4ad]">Good day</span>
              <span className="block text-sm font-semibold">Wajid Ali</span>
            </span>
            <IChevron className="hidden h-4 w-4 text-[#56615a] dark:text-[#88948d] lg:block" />
          </button>
          {accountOpen && (
            <div className="absolute right-0 mt-2 w-52 rounded-[22px] bg-vessa-card p-2 shadow-xl ring-1 ring-black/5 dark:bg-vessa-darkCard dark:ring-white/10">
              <p className="px-3 py-2 text-xs text-[#56615a] dark:text-[#a8b4ad]">
                Signed in as<br />
                <span className="font-semibold text-[#18201b] dark:text-white">{adminEmail}</span>
              </p>
              <Link to="/" className={MENU_ITEM}>View public site</Link>
              <button type="button" onClick={onLogout} className={MENU_ITEM}>Log out</button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

/* ---------- Command palette (⌘K) ---------- */
function PaletteModal({ open, query, onQuery, onClose, onSelectTab, accounts, onSelectAccount }) {
  useEffect(() => {
    if (!open) return
    const h = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  if (!open) return null
  const q = query.trim().toLowerCase()
  const matched = q
    ? accounts
        .filter((a) => `${a.business_name || ''} ${a.email || ''} ${a.slug || ''}`.toLowerCase().includes(q))
        .slice(0, 5)
    : []
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-24 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-vessa-card shadow-2xl ring-1 ring-black/10 dark:bg-vessa-darkCard dark:ring-white/10" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-black/5 px-4 py-3 dark:border-white/10">
          <ISearch className="h-5 w-5 shrink-0 text-[#56615a] dark:text-[#88948d]" />
          <input
            autoFocus
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search accounts, pages…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-[#56615a] dark:placeholder:text-white/40"
          />
          <kbd className="shrink-0 rounded-md bg-black/10 px-1.5 py-0.5 text-[10px] font-bold dark:bg-white/15">esc</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          <p className="px-2 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-[#56615a] dark:text-[#88948d]">Pages</p>
          {TABS.map((t) => (
            <button key={t.id} onClick={() => onSelectTab(t.id)} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium hover:bg-black/[0.04] dark:hover:bg-white/5">
              {t.label}
            </button>
          ))}
          {matched.length > 0 && (
            <>
              <p className="px-2 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wide text-[#56615a] dark:text-[#88948d]">Accounts</p>
              {matched.map((a) => (
                <button key={a.id} onClick={() => onSelectAccount(a)} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm hover:bg-black/[0.04] dark:hover:bg-white/5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-vessa-copper/10 text-xs font-bold text-vessa-copper dark:bg-vessa-peach/15 dark:text-vessa-peach">
                    {(a.business_name || '?').slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{a.business_name || '(No name)'}</span>
                    <span className="block truncate text-xs text-[#56615a] dark:text-[#88948d]">{a.email} · /s/{a.slug}</span>
                  </span>
                </button>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Admin() {
  const navigate = useNavigate()

  // ---- Gate state ----
  const [gate, setGate] = useState('checking') // 'checking' | 'gate' | 'locked' | 'admin'
  const [email, setEmail] = useState(import.meta.env.VITE_ADMIN_EMAIL || '')
  const [password, setPassword] = useState('')
  const [gateError, setGateError] = useState('')
  const [signingIn, setSigningIn] = useState(false)
  const [adminEmail, setAdminEmail] = useState('')

  // ---- Panel state ----
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [overview, setOverview] = useState(null)
  const [accounts, setAccounts] = useState([])
  const [campaigns, setCampaigns] = useState([])
  const [messages, setMessages] = useState([])

  // ---- Vessa shell state ----
  const [collapsed, setCollapsed] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [paletteQuery, setPaletteQuery] = useState('')
  const [bellOpen, setBellOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [productCounts, setProductCounts] = useState({})
  const { theme: adminTheme, toggleTheme: toggleAdminTheme } = useAdminTheme()

  // Accounts tab filters
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  // Chart period (must live with the other hooks — above the gate early-return)
  const [chartPeriod, setChartPeriod] = useState('daily')

  // Ads tab form state
  const [newAd, setNewAd] = useState({ title: '', placement: 'storefront-top', budget: '' })
  const [editingId, setEditingId] = useState(null)
  const [editAd, setEditAd] = useState({ title: '', placement: '', budget: '' })
  const [savingAd, setSavingAd] = useState(false)

  // ---- Gate: verify a signed-in user is the admin ----
  // With requireUnlock, a valid session only reaches the 'locked' screen —
  // the password is ALWAYS asked before the dashboard opens, so a saved
  // session alone can never walk straight into the admin panel.
  async function verifyAdmin(user, requireUnlock = false) {
    const { data, error: settingsError } = await supabase
      .from('settings')
      .select('admin_user_id')
      .eq('id', 1)
      .single()

    if (settingsError) {
      setGateError('Could not read admin settings. Run the SQL migrations and set settings.admin_user_id (see DEPLOY.md).')
      setGate('gate')
      return false
    }
    if (!data?.admin_user_id || data.admin_user_id !== user.id) {
      setGateError('Wrong password / not admin. This account is not the Zyam Web admin.')
      setGate('gate')
      return false
    }
    setAdminEmail(user.email || '')
    setGate(requireUnlock ? 'locked' : 'admin')
    return true
  }

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setGate('gate')
      return
    }
    supabase.auth.getSession().then(async ({ data }) => {
      if (data?.session?.user) {
        // Signed in already — still ask for the password (locked screen).
        await verifyAdmin(data.session.user, true)
      } else {
        setGate('gate')
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Cmd/Ctrl+K opens the command palette (admin panel only)
  useEffect(() => {
    if (gate !== 'admin') return undefined
    const h = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [gate])

  async function handleSignIn(e) {
    e.preventDefault()
    setGateError('')
    setSigningIn(true)
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    })
    setSigningIn(false)
    if (signInError || !data?.user) {
      setGateError('Wrong password / not admin. Check the email and password and try again.')
      return
    }
    const ok = await verifyAdmin(data.user)
    if (!ok) {
      // Signed in, but not the admin — sign straight back out so the gate stays clean.
      await supabase.auth.signOut()
      return
    }
    setPassword('')
    loadAll()
  }

  // Unlock from the 'locked' screen: a saved session still needs the password.
  async function handleUnlock(e) {
    e.preventDefault()
    setGateError('')
    setSigningIn(true)
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: adminEmail,
      password
    })
    setSigningIn(false)
    if (signInError || !data?.user) {
      setGateError('Wrong password. Try again.')
      return
    }
    const ok = await verifyAdmin(data.user)
    if (!ok) {
      // Signed in, but not the admin — sign straight back out so the gate stays clean.
      await supabase.auth.signOut()
      return
    }
    setPassword('')
    loadAll()
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/')
  }

  // ---- Data loading ----
  async function loadOverview() {
    const [total, free, paid, active, pending, frozen, banned, rejected, products, projects, links, ads] =
      await Promise.all([
        supabase.from('accounts').select('id', { count: 'exact', head: true }),
        supabase.from('accounts').select('id', { count: 'exact', head: true }).eq('plan', 'free'),
        supabase.from('accounts').select('id', { count: 'exact', head: true }).eq('plan', 'paid'),
        supabase.from('accounts').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('accounts').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('accounts').select('id', { count: 'exact', head: true }).eq('status', 'frozen'),
        supabase.from('accounts').select('id', { count: 'exact', head: true }).eq('status', 'banned'),
        supabase.from('accounts').select('id', { count: 'exact', head: true }).eq('status', 'rejected'),
        supabase.from('products').select('id', { count: 'exact', head: true }),
        supabase.from('projects').select('id', { count: 'exact', head: true }),
        supabase.from('bio_links').select('id', { count: 'exact', head: true }),
        supabase.from('ad_campaigns').select('budget, spend, impressions, clicks')
      ])
    const adRows = ads.data || []
    setOverview({
      total: total.count ?? 0,
      free: free.count ?? 0,
      paid: paid.count ?? 0,
      active: active.count ?? 0,
      pending: pending.count ?? 0,
      frozen: frozen.count ?? 0,
      banned: banned.count ?? 0,
      rejected: rejected.count ?? 0,
      products: products.count ?? 0,
      projects: projects.count ?? 0,
      links: links.count ?? 0,
      adBudget: adRows.reduce((s, r) => s + Number(r.budget || 0), 0),
      adSpend: adRows.reduce((s, r) => s + Number(r.spend || 0), 0),
      adImpressions: adRows.reduce((s, r) => s + Number(r.impressions || 0), 0),
      adClicks: adRows.reduce((s, r) => s + Number(r.clicks || 0), 0),
      adCount: adRows.length
    })
  }

  async function loadAccounts() {
    const { data, error: fetchError } = await supabase
      .from('accounts')
      .select('*')
      .order('created_at', { ascending: false })
    if (fetchError) throw fetchError
    setAccounts(data || [])
  }

  async function loadCampaigns() {
    const { data, error: fetchError } = await supabase
      .from('ad_campaigns')
      .select('*')
      .order('created_at', { ascending: false })
    if (fetchError) throw fetchError
    setCampaigns(data || [])
  }

  async function loadMessages() {
    const { data, error: fetchError } = await supabase
      .from('support_messages')
      .select('*')
      .order('created_at', { ascending: false })
    if (fetchError) throw fetchError
    setMessages(data || [])
  }

  async function loadProductCounts() {
    const { data, error: fetchError } = await supabase.from('products').select('account_id')
    if (fetchError) throw fetchError
    const counts = {}
    ;(data || []).forEach((row) => {
      counts[row.account_id] = (counts[row.account_id] || 0) + 1
    })
    setProductCounts(counts)
  }

  async function loadAll() {
    setLoading(true)
    setError('')
    try {
      await Promise.all([loadOverview(), loadAccounts(), loadCampaigns(), loadMessages(), loadProductCounts()])
    } catch (err) {
      setError(err.message || 'Could not load admin data.')
    } finally {
      setLoading(false)
    }
  }

  // ---- Account actions (all real Supabase writes) ----
  async function updateAccount(id, patch, label) {
    setError('')
    setNotice('')
    const { error: updateError } = await supabase.from('accounts').update(patch).eq('id', id)
    if (updateError) {
      setError(updateError.message)
      return
    }
    setNotice(label || 'Account updated.')
    await Promise.all([loadAccounts(), loadOverview()])
  }

  async function deleteAccount(id, businessName) {
    if (!window.confirm(`Delete the account "${businessName}"? Its products, projects and links will be deleted too. This cannot be undone.`)) return
    setError('')
    setNotice('')
    const { error: deleteError } = await supabase.from('accounts').delete().eq('id', id)
    if (deleteError) {
      setError(deleteError.message)
      return
    }
    setNotice('Account deleted.')
    await Promise.all([loadAccounts(), loadOverview()])
  }

  // ---- Ad actions ----
  async function createCampaign(e) {
    e.preventDefault()
    if (!newAd.title.trim() || !newAd.budget) return
    setSavingAd(true)
    setError('')
    const { error: insertError } = await supabase.from('ad_campaigns').insert({
      title: newAd.title.trim(),
      placement: newAd.placement,
      budget: Number(newAd.budget),
      status: 'running'
    })
    setSavingAd(false)
    if (insertError) {
      setError(insertError.message)
      return
    }
    setNewAd({ title: '', placement: 'storefront-top', budget: '' })
    setNotice('Campaign created and running.')
    await Promise.all([loadCampaigns(), loadOverview()])
  }

  function startEdit(campaign) {
    setEditingId(campaign.id)
    setEditAd({ title: campaign.title, placement: campaign.placement, budget: String(campaign.budget ?? '') })
  }

  async function saveEdit(id) {
    setSavingAd(true)
    setError('')
    const { error: updateError } = await supabase
      .from('ad_campaigns')
      .update({ title: editAd.title.trim(), placement: editAd.placement, budget: Number(editAd.budget) })
      .eq('id', id)
    setSavingAd(false)
    if (updateError) {
      setError(updateError.message)
      return
    }
    setEditingId(null)
    setNotice('Campaign updated.')
    await Promise.all([loadCampaigns(), loadOverview()])
  }

  async function toggleCampaign(campaign) {
    const next = campaign.status === 'running' ? 'paused' : 'running'
    setError('')
    const { error: updateError } = await supabase
      .from('ad_campaigns')
      .update({ status: next })
      .eq('id', campaign.id)
    if (updateError) {
      setError(updateError.message)
      return
    }
    setNotice(`Campaign ${next === 'running' ? 'started' : 'paused'}.`)
    await Promise.all([loadCampaigns(), loadOverview()])
  }

  async function deleteCampaign(id, title) {
    if (!window.confirm(`Delete the campaign "${title}"? This cannot be undone.`)) return
    setError('')
    const { error: deleteError } = await supabase.from('ad_campaigns').delete().eq('id', id)
    if (deleteError) {
      setError(deleteError.message)
      return
    }
    setNotice('Campaign deleted.')
    await Promise.all([loadCampaigns(), loadOverview()])
  }

  // ---- Support actions ----
  async function setMessageStatus(id, status) {
    setError('')
    const { error: updateError } = await supabase
      .from('support_messages')
      .update({ status })
      .eq('id', id)
    if (updateError) {
      setError(updateError.message)
      return
    }
    setNotice(`Message marked ${status}.`)
    await loadMessages()
  }

  async function deleteMessage(id) {
    if (!window.confirm('Delete this support message? This cannot be undone.')) return
    setError('')
    const { error: deleteError } = await supabase.from('support_messages').delete().eq('id', id)
    if (deleteError) {
      setError(deleteError.message)
      return
    }
    setNotice('Message deleted.')
    await loadMessages()
  }

  // ---- Derived: filtered accounts ----
  const filteredAccounts = accounts.filter((a) => {
    const q = search.trim().toLowerCase()
    const matchesSearch =
      !q ||
      (a.business_name || '').toLowerCase().includes(q) ||
      (a.email || '').toLowerCase().includes(q) ||
      (a.slug || '').toLowerCase().includes(q)
    const matchesPlan = planFilter === 'all' || a.plan === planFilter
    const matchesStatus = statusFilter === 'all' || a.status === statusFilter
    return matchesSearch && matchesPlan && matchesStatus
  })

  const openMessages = messages.filter((m) => m.status === 'open').length

  // ---- Render: Supabase not configured ----
  if (!isSupabaseConfigured) {
    return (
      <main className="relative flex min-h-screen items-start justify-center bg-vessa-bg font-vessa px-4 py-16 dark:bg-vessa-darkBg">
        <div className="rounded-[22px] bg-vessa-card dark:bg-vessa-darkCard p-8 shadow-[0_1px_2px_rgba(20,36,28,0.04),0_14px_34px_-22px_rgba(20,36,28,0.28)] ring-1 ring-black/5 dark:ring-white/5 dark:shadow-[0_18px_40px_-26px_rgba(0,0,0,0.85)] text-center w-full max-w-2xl">
          <h1 className="text-2xl font-semibold">Connect Supabase to enable this</h1>
          <p className="mt-3 text-[#56615a] dark:text-[#a8b4ad]">
            The admin panel needs a Supabase project. Copy <code>.env.example</code> to <code>.env</code>,
            set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>, then run the SQL
            migrations in <code>supabase/migrations/</code>. See <code>DEPLOY.md</code> for the steps.
          </p>
          <Link to="/" className="mt-6 inline-block rounded-full bg-vessa-copper px-5 py-2.5 text-sm font-semibold text-white hover:bg-vessa-copperDark dark:bg-vessa-peach dark:text-[#2b0f03] dark:hover:bg-vessa-peachLight">
            Back to home
          </Link>
        </div>
      </main>
    )
  }

  // ---- Render: password gate (always first) ----
  if (gate !== 'admin') {
    return (
      <main className="relative flex min-h-screen items-start justify-center bg-vessa-bg font-vessa px-4 py-16 dark:bg-vessa-darkBg">
        <div className="rounded-[22px] bg-vessa-card dark:bg-vessa-darkCard p-8 shadow-[0_1px_2px_rgba(20,36,28,0.04),0_14px_34px_-22px_rgba(20,36,28,0.28)] ring-1 ring-black/5 dark:ring-white/5 dark:shadow-[0_18px_40px_-26px_rgba(0,0,0,0.85)] w-full max-w-md">
          <img src="/logo-mark.png" alt="Zyam Web" className="logo-mark-copper h-12 w-12 rounded-[10px] ring-1 ring-black/10 dark:ring-white/10" />
          <h1 className="mt-4 text-2xl font-semibold">Admin sign in</h1>
          <p className="mt-2 text-sm text-[#56615a] dark:text-[#a8b4ad]">
            This area is for the Zyam Web owner only. Sign in with the admin account.
          </p>
          {gate === 'checking' ? (
            <p className="mt-6 text-sm text-[#56615a] dark:text-[#a8b4ad]">Checking your session…</p>
          ) : gate === 'locked' ? (
            <form onSubmit={handleUnlock} className="mt-6 space-y-4">
              <div className="rounded-xl bg-black/[0.04] dark:bg-white/5 px-3 py-2.5 text-sm">
                Signed in as <strong>{adminEmail}</strong> — enter your password to unlock.
              </div>
              <div>
                <label htmlFor="admin-password" className="block text-sm font-medium">Password</label>
                <input
                  id="admin-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="mt-1 w-full rounded-xl border border-black/10 dark:border-white/10 bg-vessa-card dark:bg-white/5 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-vessa-copper/50 dark:focus:ring-vessa-peach/50"
                />
              </div>
              {gateError && (
                <p role="alert" className="rounded-xl bg-rose-50 dark:bg-rose-900/30 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
                  {gateError}
                </p>
              )}
              <button
                type="submit"
                disabled={signingIn}
                className="w-full rounded-full bg-vessa-copper px-5 py-2.5 text-sm font-semibold text-white hover:bg-vessa-copperDark disabled:opacity-60 dark:bg-vessa-peach dark:text-[#2b0f03] dark:hover:bg-vessa-peachLight"
              >
                {signingIn ? 'Unlocking…' : 'Unlock admin'}
              </button>
              <button
                type="button"
                onClick={async () => {
                  await supabase.auth.signOut()
                  setPassword('')
                  setGateError('')
                  setGate('gate')
                }}
                className="w-full text-center text-sm text-vessa-copper dark:text-vessa-peach hover:underline"
              >
                Use a different account
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignIn} className="mt-6 space-y-4">
              <div>
                <label htmlFor="admin-email" className="block text-sm font-medium">Email</label>
                <input
                  id="admin-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-black/10 dark:border-white/10 bg-vessa-card dark:bg-white/5 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-vessa-copper/50 dark:focus:ring-vessa-peach/50"
                />
              </div>
              <div>
                <label htmlFor="admin-password" className="block text-sm font-medium">Password</label>
                <input
                  id="admin-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="mt-1 w-full rounded-xl border border-black/10 dark:border-white/10 bg-vessa-card dark:bg-white/5 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-vessa-copper/50 dark:focus:ring-vessa-peach/50"
                />
              </div>
              {gateError && (
                <p role="alert" className="rounded-xl bg-rose-50 dark:bg-rose-900/30 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
                  {gateError}
                </p>
              )}
              <button
                type="submit"
                disabled={signingIn}
                className="w-full rounded-full bg-vessa-copper px-5 py-2.5 text-sm font-semibold text-white hover:bg-vessa-copperDark disabled:opacity-60 dark:bg-vessa-peach dark:text-[#2b0f03] dark:hover:bg-vessa-peachLight"
              >
                {signingIn ? 'Signing in…' : 'Sign in as admin'}
              </button>
            </form>
          )}
          <Link to="/" className="mt-6 inline-block text-sm text-vessa-copper dark:text-vessa-peach hover:underline">← Back to home</Link>
        </div>
      </main>
    )
  }

  // ---- Derived data for the Vessa overview ----
  const todayLabel = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })
  const chartData = (() => {
    const now = new Date()
    const buckets = []
    if (chartPeriod === 'daily') {
      for (let i = 9; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
        buckets.push({
          label: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
          start: new Date(d.getFullYear(), d.getMonth(), d.getDate()),
          end: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59)
        })
      }
    } else if (chartPeriod === 'weekly') {
      const sow = new Date(now)
      sow.setDate(sow.getDate() - ((sow.getDay() + 6) % 7))
      sow.setHours(0, 0, 0, 0)
      for (let i = 9; i >= 0; i--) {
        const st = new Date(sow.getFullYear(), sow.getMonth(), sow.getDate() - i * 7)
        buckets.push({
          label: st.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
          start: st,
          end: new Date(st.getFullYear(), st.getMonth(), st.getDate() + 6, 23, 59, 59)
        })
      }
    } else {
      for (let i = 9; i >= 0; i--) {
        const st = new Date(now.getFullYear(), now.getMonth() - i, 1)
        buckets.push({
          label: st.toLocaleDateString('en-GB', { month: 'short' }),
          start: st,
          end: new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59)
        })
      }
    }
    return buckets.map((bk) => {
      const inBucket = accounts.filter((x) => {
        if (!x.created_at) return false
        const t = new Date(x.created_at)
        return t >= bk.start && t <= bk.end
      })
      const total = accounts.filter((x) => x.created_at && new Date(x.created_at) <= bk.end).length
      return {
        label: bk.label,
        newCount: inBucket.length,
        approvedCount: inBucket.filter((x) => x.status === 'active').length,
        totalCount: total
      }
    })
  })()
  const monthSignups = accounts.filter((x) => {
    const d = x.created_at ? new Date(x.created_at) : null
    const n = new Date()
    return d && d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth()
  }).length
  const pendingAccounts = accounts.filter((x) => x.status === 'pending').slice(0, 3)
  const typeRows = [
    { label: 'Stores', count: accounts.filter((x) => x.type === 'store').length, bar: 'bg-vessa-copper dark:bg-vessa-peach' },
    { label: 'Freelancers', count: accounts.filter((x) => x.type === 'freelancer').length, bar: 'bg-vessa-teal dark:bg-vessa-tealLight' },
    { label: 'Influencers', count: accounts.filter((x) => x.type === 'influencer').length, bar: 'bg-vessa-sky dark:bg-vessa-skyLight' }
  ]
  const topStores = [...accounts]
    .sort((a, b) => (productCounts[b.id] || 0) - (productCounts[a.id] || 0))
    .slice(0, 3)
  const recentAccounts = accounts.slice(0, 4)
  const alertItems = []
  if (overview && overview.pending > 0)
    alertItems.push({
      key: 'pending',
      tone: 'bg-rose-400',
      title: `${overview.pending} account${overview.pending === 1 ? '' : 's'} pending approval`,
      sub: 'Review and approve or reject them.',
      onClick: () => {
        setActiveTab('accounts')
        setStatusFilter('pending')
      }
    })
  if (overview && overview.frozen > 0)
    alertItems.push({
      key: 'frozen',
      tone: 'bg-sky-400',
      title: `${overview.frozen} frozen account${overview.frozen === 1 ? '' : 's'}`,
      sub: 'Frozen after 45 days of inactivity.',
      onClick: () => {
        setActiveTab('accounts')
        setStatusFilter('frozen')
      }
    })
  if (openMessages > 0)
    alertItems.push({
      key: 'support',
      tone: 'bg-teal-500',
      title: `${openMessages} support message${openMessages === 1 ? '' : 's'} open`,
      sub: 'From the landing-page contact form.',
      onClick: () => setActiveTab('support')
    })
  if (overview && overview.rejected > 0)
    alertItems.push({
      key: 'rejected',
      tone: 'bg-amber-400',
      title: `${overview.rejected} rejected`,
      sub: 'Rejected accounts.',
      onClick: () => {
        setActiveTab('accounts')
        setStatusFilter('rejected')
      }
    })
  const pendingShare = overview && overview.total > 0 ? Math.round((overview.pending / overview.total) * 100) : 0
  const bellCount = (overview?.pending || 0) + openMessages

  // ---- Render: admin panel (Vessa shell) ----
  return (
    <div className="min-h-screen bg-vessa-bg font-vessa text-[#18201b] dark:bg-vessa-darkBg dark:text-[#ecf2ee]">
      <div className="mx-auto max-w-[1400px] p-3 sm:p-4">
          <AdminTopBar
            activeTab={activeTab}
            onSelect={(id) => {
              setActiveTab(id)
              setBellOpen(false)
              setAccountOpen(false)
            }}
            onOpenPalette={() => setPaletteOpen(true)}
            onRefresh={loadAll}
            bellCount={bellCount}
            bellOpen={bellOpen}
            onToggleBell={() => {
              setBellOpen((v) => !v)
              setAccountOpen(false)
            }}
            alerts={alertItems}
            onAlertClick={(a) => {
              setBellOpen(false)
              a.onClick()
            }}
            onNew={() => setActiveTab('ads')}
            adminEmail={adminEmail}
            accountOpen={accountOpen}
            onToggleAccount={() => {
              setAccountOpen((v) => !v)
              setBellOpen(false)
            }}
            onLogout={handleLogout}
          />
        <div className="mt-4 flex gap-4">
        <AdminSidebar
          activeTab={activeTab}
          onSelect={(id) => {
            setActiveTab(id)
            setBellOpen(false)
            setAccountOpen(false)
          }}
          pending={overview?.pending || 0}
          openMessages={openMessages}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((v) => !v)}
          theme={adminTheme}
          onToggleTheme={toggleAdminTheme}
          onLogout={handleLogout}
        />
          <div className="min-w-0 flex-1">
          <main className="pb-24 md:pb-8">
            {error && (
              <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">{error}</p>
            )}
            {notice && (
              <p role="status" className="mt-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">{notice}</p>
            )}
            {loading && <p className="mt-4 text-sm text-[#56615a] dark:text-[#a8b4ad]">Loading…</p>}

            {/* ---------- OVERVIEW (Vessa grid) ---------- */}
            {activeTab === 'overview' && overview && (
              <section className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                  <div className="vessa-rise px-1 py-2 md:col-span-2" style={{ animationDelay: '0ms' }}>
                    <p className="flex items-center gap-2 text-xs font-medium text-[#56615a] dark:text-[#a8b4ad]">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      {todayLabel}
                    </p>
                    <h1 className="mt-3 text-[38px] font-bold leading-[1.05] tracking-[-0.02em]">Welcome back, Wajid!</h1>
                    <p className="mt-2 text-sm leading-relaxed text-[#56615a] dark:text-[#a8b4ad]">
                      Here is what is happening on your platform today — {overview.pending} account{overview.pending === 1 ? '' : 's'} waiting for approval
                      {openMessages > 0 ? ` and ${openMessages} support message${openMessages === 1 ? '' : 's'} open` : ''}.
                    </p>
                    <div className="mt-5 flex flex-wrap gap-2">
                      <button
                        onClick={() => {
                          setActiveTab('accounts')
                          setStatusFilter('pending')
                        }}
                        className="rounded-full bg-vessa-copper px-4 py-2 text-sm font-semibold text-white hover:bg-vessa-copperDark dark:bg-vessa-peach dark:text-[#2b0f03] dark:hover:bg-vessa-peachLight"
                      >
                        Review pending
                      </button>
                      <button
                        onClick={() => setActiveTab('ads')}
                        className="rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-black/15 hover:bg-black/[0.03] dark:ring-white/20 dark:hover:bg-white/5"
                      >
                        New campaign
                      </button>
                    </div>
                  </div>

                  <div className="vessa-rise relative overflow-hidden rounded-[22px] bg-vessa-card p-5 shadow-[0_1px_2px_rgba(20,36,28,0.04),0_14px_34px_-22px_rgba(20,36,28,0.28)] ring-1 ring-black/5 dark:bg-vessa-darkCard dark:ring-white/5 dark:shadow-[0_18px_40px_-26px_rgba(0,0,0,0.85)]" style={{ animationDelay: '60ms' }}>
                    <span aria-hidden="true" className="pointer-events-none absolute -bottom-10 -right-10 h-32 w-32 rounded-full border-[10px] border-black/[0.03] dark:border-white/[0.04]" />
                    <span aria-hidden="true" className="pointer-events-none absolute -bottom-6 -right-6 h-32 w-32 rounded-full border-[10px] border-black/[0.03] dark:border-white/[0.04]" />
                    <div className="relative flex items-start justify-between">
                      <p className="text-sm font-medium text-[#56615a] dark:text-[#a8b4ad]">Total accounts</p>
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-vessa-copper text-white dark:bg-vessa-peach dark:text-[#2b0f03]"><IUsers className="h-4 w-4" /></span>
                    </div>
                    <div className="relative mt-2 flex flex-wrap items-baseline gap-x-2">
                      <p className="text-[28px] font-bold leading-none tabular-nums"><CountUp value={overview.total} /></p>
                      <span className="text-xs font-semibold text-[#23804d] dark:text-[#6fd38e]">↗ +{monthSignups} this month</span>
                    </div>
                    <p className="relative mt-1 text-xs text-[#56615a] dark:text-[#88948d]">{overview.free} free · {overview.paid} paid</p>
                    <Sparkline data={chartData.map((d) => d.totalCount)} stroke="#a8481c" className="relative mt-3 h-8 w-24" />
                  </div>

                  <div className="vessa-rise relative overflow-hidden rounded-[22px] bg-vessa-card p-5 shadow-[0_1px_2px_rgba(20,36,28,0.04),0_14px_34px_-22px_rgba(20,36,28,0.28)] ring-1 ring-black/5 dark:bg-vessa-darkCard dark:ring-white/5 dark:shadow-[0_18px_40px_-26px_rgba(0,0,0,0.85)]" style={{ animationDelay: '120ms' }}>
                    <span aria-hidden="true" className="pointer-events-none absolute -bottom-10 -right-10 h-32 w-32 rounded-full border-[10px] border-black/[0.03] dark:border-white/[0.04]" />
                    <span aria-hidden="true" className="pointer-events-none absolute -bottom-6 -right-6 h-32 w-32 rounded-full border-[10px] border-black/[0.03] dark:border-white/[0.04]" />
                    <div className="relative flex items-start justify-between">
                      <p className="text-sm font-medium text-[#56615a] dark:text-[#a8b4ad]">Pending approval</p>
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#c88a12] text-white dark:bg-[#f2c056] dark:text-[#2b0f03]"><IAlert className="h-4 w-4" /></span>
                    </div>
                    <div className="relative mt-2 flex flex-wrap items-baseline gap-x-2">
                      <p className="text-[28px] font-bold leading-none tabular-nums"><CountUp value={overview.pending} /></p>
                      <span className="text-xs font-semibold text-[#93600a] dark:text-[#f2c056]">⚠ {overview.pending} waiting</span>
                    </div>
                    <p className="relative mt-1 text-xs text-[#56615a] dark:text-[#88948d]">of {overview.total} accounts</p>
                    <Sparkline data={chartData.map((d) => d.newCount - d.approvedCount)} stroke="#c88a12" className="relative mt-3 h-8 w-24" />
                  </div>

                  <div className="vessa-rise relative overflow-hidden rounded-[22px] bg-vessa-card p-5 shadow-[0_1px_2px_rgba(20,36,28,0.04),0_14px_34px_-22px_rgba(20,36,28,0.28)] ring-1 ring-black/5 dark:bg-vessa-darkCard dark:ring-white/5 dark:shadow-[0_18px_40px_-26px_rgba(0,0,0,0.85)]" style={{ animationDelay: '180ms' }}>
                    <span aria-hidden="true" className="pointer-events-none absolute -bottom-10 -right-10 h-32 w-32 rounded-full border-[10px] border-black/[0.03] dark:border-white/[0.04]" />
                    <span aria-hidden="true" className="pointer-events-none absolute -bottom-6 -right-6 h-32 w-32 rounded-full border-[10px] border-black/[0.03] dark:border-white/[0.04]" />
                    <div className="relative flex items-start justify-between">
                      <p className="text-sm font-medium text-[#56615a] dark:text-[#a8b4ad]">Products listed</p>
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-vessa-teal text-white dark:bg-vessa-tealLight dark:text-[#0f1412]"><IPackage className="h-4 w-4" /></span>
                    </div>
                    <div className="relative mt-2 flex flex-wrap items-baseline gap-x-2">
                      <p className="text-[28px] font-bold leading-none tabular-nums"><CountUp value={overview.products} /></p>
                    </div>
                    <p className="relative mt-1 text-xs text-[#56615a] dark:text-[#88948d]">Across {accounts.length} store{accounts.length === 1 ? '' : 's'} · {overview.adCount} ad campaign{overview.adCount === 1 ? '' : 's'}</p>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="vessa-rise rounded-[22px] bg-vessa-card p-6 shadow-[0_1px_2px_rgba(20,36,28,0.04),0_14px_34px_-22px_rgba(20,36,28,0.28)] ring-1 ring-black/5 dark:bg-vessa-darkCard dark:ring-white/5 dark:shadow-[0_18px_40px_-26px_rgba(0,0,0,0.85)] lg:col-span-2" style={{ animationDelay: '220ms' }}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold">Accounts statistics</h2>
                        <p className="text-xs text-[#56615a] dark:text-[#88948d]">New signups · last 10 {chartPeriod === 'daily' ? 'days' : chartPeriod === 'weekly' ? 'weeks' : 'months'}</p>
                      </div>
                      <select
                        value={chartPeriod}
                        onChange={(e) => setChartPeriod(e.target.value)}
                        aria-label="Chart period"
                        className="cursor-pointer rounded-full bg-black/[0.04] px-3 py-1 text-xs font-semibold outline-none dark:bg-white/5"
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>
                    <div className="mt-5">
                      <SignupChart data={chartData} />
                    </div>
                    <p className="mt-4 border-t border-black/5 pt-3 text-sm text-[#56615a] dark:border-white/10 dark:text-[#a8b4ad]">
                      This month so far: <strong className="text-[#18201b] dark:text-white">{monthSignups} new account{monthSignups === 1 ? '' : 's'}</strong> · {overview.pending} pending approval
                    </p>
                  </div>

                  <div className="vessa-rise rounded-[22px] bg-vessa-card p-6 shadow-[0_1px_2px_rgba(20,36,28,0.04),0_14px_34px_-22px_rgba(20,36,28,0.28)] ring-1 ring-black/5 dark:bg-vessa-darkCard dark:ring-white/5 dark:shadow-[0_18px_40px_-26px_rgba(0,0,0,0.85)]" style={{ animationDelay: '280ms' }}>
                    <h2 className="text-lg font-semibold">Approval progress</h2>
                    <div className="mt-4">
                      <Gauge percent={pendingShare} center={`${pendingShare}%`} label="Pending review" />
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-center">
                      <div>
                        <p className="text-2xl font-bold tabular-nums">{overview.active}</p>
                        <p className="text-xs text-[#56615a] dark:text-[#88948d]">Active</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold tabular-nums">{overview.pending}</p>
                        <p className="text-xs text-[#56615a] dark:text-[#88948d]">Pending</p>
                      </div>
                    </div>
                    <div className="mt-5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold">Approval progress</span>
                        <span className="text-[#56615a] dark:text-[#a8b4ad]">{overview.active} of {overview.total} approved</span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/10">
                        <div className="h-full rounded-full bg-vessa-copper transition-all duration-1000 dark:bg-vessa-peach" style={{ width: `${overview.total > 0 ? Math.round((overview.active / overview.total) * 100) : 0}%` }} />
                      </div>
                      <p className="mt-2 text-center text-xs text-[#56615a] dark:text-[#a8b4ad]">{overview.pending} account{overview.pending === 1 ? '' : 's'} waiting for approval</p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="vessa-rise rounded-[22px] bg-vessa-card p-5 shadow-[0_1px_2px_rgba(20,36,28,0.04),0_14px_34px_-22px_rgba(20,36,28,0.28)] ring-1 ring-black/5 dark:bg-vessa-darkCard dark:ring-white/5 dark:shadow-[0_18px_40px_-26px_rgba(0,0,0,0.85)]" style={{ animationDelay: '320ms' }}>
                    <h2 className="text-lg font-semibold">Recent accounts</h2>
                    {recentAccounts.length === 0 ? (
                      <p className="mt-4 text-sm text-[#56615a] dark:text-[#a8b4ad]">No accounts yet.</p>
                    ) : (
                      <ul className="mt-4 space-y-3">
                        {recentAccounts.map((a) => (
                          <li key={a.id} className="flex items-center gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-vessa-copper/10 text-sm font-bold text-vessa-copper dark:bg-vessa-peach/15 dark:text-vessa-peach">
                              {(a.business_name || '?').slice(0, 1).toUpperCase()}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold">{a.business_name || '(No name)'}</span>
                              <span className="block truncate text-xs text-[#56615a] dark:text-[#88948d]">{a.email} · /s/{a.slug}</span>
                              <span className="block text-[11px] text-[#56615a] dark:text-[#88948d]">{timeAgo(a.created_at)}</span>
                            </span>
                            <StatusPill status={a.status} />
                            <button
                              type="button"
                              onClick={() => {
                                setActiveTab('accounts')
                                setSearch(a.business_name || '')
                              }}
                              aria-label={`Open ${a.business_name || 'account'} in Accounts`}
                              title="Open in Accounts"
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#56615a] hover:bg-black/[0.04] dark:text-[#a8b4ad] dark:hover:bg-white/5"
                            >
                              ⋮
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <button onClick={() => setActiveTab('accounts')} className="mt-4 text-sm font-semibold text-vessa-copper hover:underline dark:text-vessa-peach">
                      View all accounts →
                    </button>
                  </div>

                  <div className="vessa-rise rounded-[22px] bg-vessa-card p-5 shadow-[0_1px_2px_rgba(20,36,28,0.04),0_14px_34px_-22px_rgba(20,36,28,0.28)] ring-1 ring-black/5 dark:bg-vessa-darkCard dark:ring-white/5 dark:shadow-[0_18px_40px_-26px_rgba(0,0,0,0.85)]" style={{ animationDelay: '360ms' }}>
                    <h2 className="text-lg font-semibold">Alerts &amp; notifications</h2>
                    {alertItems.length === 0 ? (
                      <p className="mt-4 text-sm text-[#56615a] dark:text-[#a8b4ad]">All clear — nothing needs you.</p>
                    ) : (
                      <div className="mt-3 space-y-1">
                        {alertItems.map((a) => (
                          <button key={a.key} onClick={a.onClick} className="flex w-full items-start gap-3 rounded-2xl px-2 py-2.5 text-left hover:bg-black/[0.03] dark:hover:bg-white/5">
                            <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${a.tone}`} />
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-semibold">{a.title}</span>
                              <span className="block text-xs text-[#56615a] dark:text-[#88948d]">{a.sub}</span>
                            </span>
                            <span className="text-[#56615a] dark:text-[#88948d]">›</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="vessa-rise rounded-[22px] bg-vessa-card p-5 shadow-[0_1px_2px_rgba(20,36,28,0.04),0_14px_34px_-22px_rgba(20,36,28,0.28)] ring-1 ring-black/5 dark:bg-vessa-darkCard dark:ring-white/5 dark:shadow-[0_18px_40px_-26px_rgba(0,0,0,0.85)]" style={{ animationDelay: '400ms' }}>
                    <h2 className="text-lg font-semibold">Top stores</h2>
                    <p className="text-xs text-[#56615a] dark:text-[#88948d]">By products listed</p>
                    {topStores.length === 0 || topStores.every((a) => (productCounts[a.id] || 0) === 0) ? (
                      <p className="mt-4 text-sm text-[#56615a] dark:text-[#a8b4ad]">No products listed yet.</p>
                    ) : (
                      <ul className="mt-4 space-y-3">
                        {topStores.map((a, i) => (
                          <li key={a.id} className="flex items-center gap-3">
                            <span className="w-5 shrink-0 text-sm font-bold text-[#56615a] dark:text-[#88948d]">0{i + 1}</span>
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-vessa-copper/10 text-sm font-bold text-vessa-copper dark:bg-vessa-peach/15 dark:text-vessa-peach">
                              {(a.business_name || '?').slice(0, 1).toUpperCase()}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold">{a.business_name || '(No name)'}</span>
                              <span className="block truncate text-xs text-[#56615a] dark:text-[#88948d]">/s/{a.slug} · {a.type}</span>
                            </span>
                            <span className="shrink-0 text-sm font-bold tabular-nums">{productCounts[a.id] || 0} <span className="text-xs font-medium text-[#56615a] dark:text-[#88948d]">items</span></span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="vessa-rise rounded-[22px] bg-vessa-card p-5 shadow-[0_1px_2px_rgba(20,36,28,0.04),0_14px_34px_-22px_rgba(20,36,28,0.28)] ring-1 ring-black/5 dark:bg-vessa-darkCard dark:ring-white/5 dark:shadow-[0_18px_40px_-26px_rgba(0,0,0,0.85)] lg:col-span-2" style={{ animationDelay: '440ms' }}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold">Approval queue</h2>
                        <p className="text-xs text-[#56615a] dark:text-[#88948d]">{overview.pending} account{overview.pending === 1 ? '' : 's'} waiting for your decision</p>
                      </div>
                      <button
                        onClick={() => {
                          setActiveTab('accounts')
                          setStatusFilter('pending')
                        }}
                        className="shrink-0 text-sm font-semibold text-vessa-copper hover:underline dark:text-vessa-peach"
                      >
                        Open board
                      </button>
                    </div>
                    {pendingAccounts.length === 0 ? (
                      <p className="mt-4 text-sm text-[#56615a] dark:text-[#a8b4ad]">Nothing waiting — every account is decided.</p>
                    ) : (
                      <ul className="mt-4 space-y-3">
                        {pendingAccounts.map((a) => (
                          <li key={a.id} className="flex flex-wrap items-center gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-vessa-copper/10 text-sm font-bold text-vessa-copper dark:bg-vessa-peach/15 dark:text-vessa-peach">
                              {(a.business_name || '?').slice(0, 1).toUpperCase()}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold">{a.business_name || '(No name)'}</span>
                              <span className="block truncate text-xs text-[#56615a] dark:text-[#88948d]">{a.email} · /s/{a.slug} · {timeAgo(a.created_at)}</span>
                            </span>
                            <span className="flex gap-2">
                              <button onClick={() => updateAccount(a.id, { status: 'active' })} className="rounded-full bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">Approve</button>
                              <button onClick={() => updateAccount(a.id, { status: 'rejected' })} className="rounded-full border border-black/10 px-3.5 py-1.5 text-xs font-semibold hover:bg-black/[0.03] dark:border-white/10 dark:hover:bg-white/5">Reject</button>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="vessa-rise rounded-[22px] bg-vessa-card p-5 shadow-[0_1px_2px_rgba(20,36,28,0.04),0_14px_34px_-22px_rgba(20,36,28,0.28)] ring-1 ring-black/5 dark:bg-vessa-darkCard dark:ring-white/5 dark:shadow-[0_18px_40px_-26px_rgba(0,0,0,0.85)]" style={{ animationDelay: '480ms' }}>
                    <h2 className="text-lg font-semibold">Accounts by type</h2>
                    <p className="text-xs text-[#56615a] dark:text-[#88948d]">Stores, freelancers &amp; influencers</p>
                    <div className="mt-4 space-y-4">
                      {typeRows.map((t) => (
                        <div key={t.label}>
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">{t.label}</span>
                            <span className="text-xs text-[#56615a] dark:text-[#a8b4ad]">{t.count} of {overview.total}</span>
                          </div>
                          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/10">
                            <div className={`h-full rounded-full ${t.bar}`} style={{ width: `${overview.total > 0 ? Math.round((t.count / overview.total) * 100) : 0}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            )}

                  {/* ---------- ACCOUNTS ---------- */}
      {activeTab === 'accounts' && (
        <section className="mt-6">
          <div className="flex flex-wrap gap-3">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by business name, email or slug…"
              aria-label="Search accounts"
              className="min-w-0 flex-1 rounded-xl border border-black/10 dark:border-white/10 bg-vessa-card dark:bg-vessa-darkCard px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-vessa-copper/50 dark:focus:ring-vessa-peach/50"
            />
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              aria-label="Filter by plan"
              className="rounded-xl border border-black/10 dark:border-white/10 bg-vessa-card dark:bg-vessa-darkCard px-3 py-2.5 text-sm"
            >
              <option value="all">All plans</option>
              <option value="free">{PLANS.free.name}</option>
              <option value="paid">{PLANS.paid.name}</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by status"
              className="rounded-xl border border-black/10 dark:border-white/10 bg-vessa-card dark:bg-vessa-darkCard px-3 py-2.5 text-sm"
            >
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="active">Active</option>
              <option value="frozen">Frozen</option>
              <option value="rejected">Rejected</option>
              <option value="banned">Banned</option>
            </select>
          </div>

          {filteredAccounts.length === 0 ? (
            <p className="mt-8 rounded-[22px] bg-vessa-card dark:bg-vessa-darkCard p-6 text-center text-sm text-[#56615a] dark:text-[#a8b4ad] ring-1 ring-black/5 dark:ring-white/10">
              No accounts match this search. Try a different search or filter.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {filteredAccounts.map((account) => {
                const inactiveDays = account.last_active_at ? daysSince(account.last_active_at) : null
                return (
                  <li key={account.id} className="rounded-[22px] bg-vessa-card dark:bg-vessa-darkCard p-5 shadow-[0_1px_2px_rgba(20,36,28,0.04),0_14px_34px_-22px_rgba(20,36,28,0.28)] ring-1 ring-black/5 dark:ring-white/5 dark:shadow-[0_18px_40px_-26px_rgba(0,0,0,0.85)]">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{account.business_name || '(No business name)'}</p>
                        <p className="text-sm text-[#56615a] dark:text-[#a8b4ad]">
                          {account.email} · /s/{account.slug} · {account.type} · {THEMES[account.theme]?.name || account.theme || 'Lavender'}
                        </p>
                        <p className="mt-1 text-xs text-[#56615a] dark:text-[#a8b4ad]">
                          Plan: <strong>{PLANS[account.plan]?.name || account.plan}</strong>
                          {account.last_active_at
                            ? ` · Last active ${new Date(account.last_active_at).toLocaleDateString()} (${inactiveDays} days ago${account.plan === 'free' ? `, ${Math.max(0, FREEZE_DAYS - inactiveDays)} days left before freeze` : ', never freezes'})`
                            : ' · Never active'}
                          {' · '}Joined {account.created_at ? new Date(account.created_at).toLocaleDateString() : '—'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusPill status={account.status} />
                        <Link
                          to={`/s/${account.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full border border-black/10 dark:border-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-black/[0.03] dark:hover:bg-white/5"
                        >
                          Open public page
                        </Link>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {account.status === 'pending' && (
                        <>
                          <button onClick={() => updateAccount(account.id, { status: 'active' }, 'Account approved and activated.')} className="rounded-full bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">Approve</button>
                          <button onClick={() => updateAccount(account.id, { status: 'rejected' }, 'Account rejected.')} className="rounded-full bg-rose-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-700">Reject</button>
                        </>
                      )}
                      {account.status === 'active' && (
                        <button onClick={() => updateAccount(account.id, { status: 'frozen' }, 'Account frozen.')} className="rounded-full bg-sky-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-sky-700">Freeze</button>
                      )}
                      {account.status === 'frozen' && (
                        <button onClick={() => updateAccount(account.id, { status: 'active', last_active_at: new Date().toISOString() }, 'Account unfrozen and activated.')} className="rounded-full bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">Unfreeze</button>
                      )}
                      {(account.status === 'active' || account.status === 'frozen' || account.status === 'pending') && (
                        <button onClick={() => updateAccount(account.id, { status: 'banned' }, 'Account banned.')} className="rounded-full bg-red-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700">Ban</button>
                      )}
                      {account.status === 'banned' && (
                        <button onClick={() => updateAccount(account.id, { status: 'active' }, 'Account unbanned and activated.')} className="rounded-full bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">Unban</button>
                      )}
                      {account.status === 'rejected' && (
                        <button onClick={() => updateAccount(account.id, { status: 'active' }, 'Account approved and activated.')} className="rounded-full bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">Approve</button>
                      )}
                      {account.plan === 'free' ? (
                        <button onClick={() => updateAccount(account.id, { plan: 'paid' }, 'Plan set to Paid.')} className="rounded-full border border-vessa-copper/40 dark:border-vessa-peach/40 px-3.5 py-1.5 text-xs font-semibold text-vessa-copper dark:text-vessa-peach hover:bg-black/[0.03] dark:hover:bg-white/5">Set plan: Paid</button>
                      ) : (
                        <button onClick={() => updateAccount(account.id, { plan: 'free' }, 'Plan set to Free.')} className="rounded-full border border-vessa-copper/40 dark:border-vessa-peach/40 px-3.5 py-1.5 text-xs font-semibold text-vessa-copper dark:text-vessa-peach hover:bg-black/[0.03] dark:hover:bg-white/5">Set plan: Free</button>
                      )}
                      <button onClick={() => deleteAccount(account.id, account.business_name || account.slug)} className="rounded-full border border-red-300 px-3.5 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">Delete</button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}

                  {/* ---------- ADS ---------- */}
      {activeTab === 'ads' && (
        <section className="mt-6 space-y-6">
          <form onSubmit={createCampaign} className="rounded-[22px] bg-vessa-card dark:bg-vessa-darkCard p-5 shadow-[0_1px_2px_rgba(20,36,28,0.04),0_14px_34px_-22px_rgba(20,36,28,0.28)] ring-1 ring-black/5 dark:ring-white/5 dark:shadow-[0_18px_40px_-26px_rgba(0,0,0,0.85)]">
            <h2 className="text-lg font-semibold">Create campaign</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <input
                type="text"
                required
                value={newAd.title}
                onChange={(e) => setNewAd({ ...newAd, title: e.target.value })}
                placeholder="Campaign title"
                aria-label="Campaign title"
                className="rounded-xl border border-black/10 dark:border-white/10 bg-vessa-card dark:bg-white/5 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-vessa-copper/50 dark:focus:ring-vessa-peach/50 md:col-span-2"
              />
              <select
                value={newAd.placement}
                onChange={(e) => setNewAd({ ...newAd, placement: e.target.value })}
                aria-label="Ad placement"
                className="rounded-xl border border-black/10 dark:border-white/10 bg-vessa-card dark:bg-white/5 px-3 py-2.5 text-sm"
              >
                <option value="storefront-top">Storefront top</option>
                <option value="storefront-bottom">Storefront bottom</option>
                <option value="landing">Landing page</option>
              </select>
              <input
                type="number"
                required
                min="0"
                step="1"
                value={newAd.budget}
                onChange={(e) => setNewAd({ ...newAd, budget: e.target.value })}
                placeholder="Budget (Rs)"
                aria-label="Budget in rupees"
                className="rounded-xl border border-black/10 dark:border-white/10 bg-vessa-card dark:bg-white/5 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-vessa-copper/50 dark:focus:ring-vessa-peach/50"
              />
            </div>
            <button
              type="submit"
              disabled={savingAd}
              className="mt-4 rounded-full bg-vessa-copper px-5 py-2.5 text-sm font-semibold text-white hover:bg-vessa-copperDark disabled:opacity-60 dark:bg-vessa-peach dark:text-[#2b0f03] dark:hover:bg-vessa-peachLight"
            >
              {savingAd ? 'Creating…' : 'Create campaign'}
            </button>
          </form>

          {campaigns.length === 0 ? (
            <p className="rounded-[22px] bg-vessa-card dark:bg-vessa-darkCard p-6 text-center text-sm text-[#56615a] dark:text-[#a8b4ad] ring-1 ring-black/5 dark:ring-white/10">
              No ad campaigns yet. Create one above.
            </p>
          ) : (
            <ul className="space-y-3">
              {campaigns.map((campaign) => (
                <li key={campaign.id} className="rounded-[22px] bg-vessa-card dark:bg-vessa-darkCard p-5 shadow-[0_1px_2px_rgba(20,36,28,0.04),0_14px_34px_-22px_rgba(20,36,28,0.28)] ring-1 ring-black/5 dark:ring-white/5 dark:shadow-[0_18px_40px_-26px_rgba(0,0,0,0.85)]">
                  {editingId === campaign.id ? (
                    <div className="grid gap-3 md:grid-cols-4">
                      <input
                        type="text"
                        value={editAd.title}
                        onChange={(e) => setEditAd({ ...editAd, title: e.target.value })}
                        aria-label="Edit campaign title"
                        className="rounded-xl border border-black/10 dark:border-white/10 bg-vessa-card dark:bg-white/5 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-vessa-copper/50 dark:focus:ring-vessa-peach/50 md:col-span-2"
                      />
                      <select
                        value={editAd.placement}
                        onChange={(e) => setEditAd({ ...editAd, placement: e.target.value })}
                        aria-label="Edit placement"
                        className="rounded-xl border border-black/10 dark:border-white/10 bg-vessa-card dark:bg-white/5 px-3 py-2.5 text-sm"
                      >
                        <option value="storefront-top">Storefront top</option>
                        <option value="storefront-bottom">Storefront bottom</option>
                        <option value="landing">Landing page</option>
                      </select>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={editAd.budget}
                        onChange={(e) => setEditAd({ ...editAd, budget: e.target.value })}
                        aria-label="Edit budget"
                        className="rounded-xl border border-black/10 dark:border-white/10 bg-vessa-card dark:bg-white/5 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-vessa-copper/50 dark:focus:ring-vessa-peach/50"
                      />
                      <div className="flex gap-2 md:col-span-4">
                        <button onClick={() => saveEdit(campaign.id)} disabled={savingAd} className="rounded-full bg-vessa-copper px-4 py-2 text-xs font-semibold text-white hover:bg-vessa-copperDark disabled:opacity-60 dark:bg-vessa-peach dark:text-[#2b0f03] dark:hover:bg-vessa-peachLight">Save</button>
                        <button onClick={() => setEditingId(null)} className="rounded-full border border-black/10 dark:border-white/10 px-4 py-2 text-xs font-semibold">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{campaign.title}</p>
                          <p className="text-sm text-[#56615a] dark:text-[#a8b4ad]">
                            Placement: {campaign.placement} · Created {campaign.created_at ? new Date(campaign.created_at).toLocaleDateString() : '—'}
                          </p>
                        </div>
                        <StatusPill status={campaign.status === 'running' ? 'active' : 'pending'} />
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                        <p><span className="text-[#56615a] dark:text-[#a8b4ad]">Budget</span><br /><strong>Rs {Number(campaign.budget || 0).toLocaleString()}</strong></p>
                        <p><span className="text-[#56615a] dark:text-[#a8b4ad]">Spend</span><br /><strong>Rs {Number(campaign.spend || 0).toLocaleString()}</strong></p>
                        <p><span className="text-[#56615a] dark:text-[#a8b4ad]">Impressions</span><br /><strong>{Number(campaign.impressions || 0).toLocaleString()}</strong></p>
                        <p><span className="text-[#56615a] dark:text-[#a8b4ad]">Clicks</span><br /><strong>{Number(campaign.clicks || 0).toLocaleString()}</strong></p>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          onClick={() => toggleCampaign(campaign)}
                          className={`rounded-full px-4 py-2 text-xs font-semibold text-white ${campaign.status === 'running' ? 'bg-sky-600 hover:bg-sky-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                        >
                          {campaign.status === 'running' ? 'Pause' : 'Start'}
                        </button>
                        <button onClick={() => startEdit(campaign)} className="rounded-full border border-black/10 dark:border-white/10 px-4 py-2 text-xs font-semibold hover:bg-black/[0.03] dark:hover:bg-white/5">Edit</button>
                        <button onClick={() => deleteCampaign(campaign.id, campaign.title)} className="rounded-full border border-red-300 px-4 py-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">Delete</button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

                  {/* ---------- SUPPORT ---------- */}
      {activeTab === 'support' && (
        <section className="mt-6">
          {messages.length === 0 ? (
            <p className="rounded-[22px] bg-vessa-card dark:bg-vessa-darkCard p-6 text-center text-sm text-[#56615a] dark:text-[#a8b4ad] ring-1 ring-black/5 dark:ring-white/10">
              No support messages yet. Messages from the landing-page contact form and plan-upgrade requests will appear here.
            </p>
          ) : (
            <ul className="space-y-3">
              {messages.map((message) => (
                <li key={message.id} className="rounded-[22px] bg-vessa-card dark:bg-vessa-darkCard p-5 shadow-[0_1px_2px_rgba(20,36,28,0.04),0_14px_34px_-22px_rgba(20,36,28,0.28)] ring-1 ring-black/5 dark:ring-white/5 dark:shadow-[0_18px_40px_-26px_rgba(0,0,0,0.85)]">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{message.name || '(No name)'} <span className="font-normal text-[#56615a] dark:text-[#a8b4ad]">· {message.email || 'no email'}</span></p>
                      <p className="text-xs text-[#56615a] dark:text-[#a8b4ad]">
                        {message.created_at ? new Date(message.created_at).toLocaleString() : '—'}
                      </p>
                    </div>
                    <StatusPill status={message.status === 'open' ? 'pending' : 'active'} />
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm">{message.message}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {message.status === 'open' ? (
                      <button onClick={() => setMessageStatus(message.id, 'resolved')} className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700">Mark resolved</button>
                    ) : (
                      <button onClick={() => setMessageStatus(message.id, 'open')} className="rounded-full border border-black/10 dark:border-white/10 px-4 py-2 text-xs font-semibold hover:bg-black/[0.03] dark:hover:bg-white/5">Reopen</button>
                    )}
                    <button onClick={() => deleteMessage(message.id)} className="rounded-full border border-red-300 px-4 py-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">Delete</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

          </main>
        </div>
      </div>
      </div>

      {/* Mobile bottom nav (Vessa shell has no global TopBar on /admin) */}
      <nav aria-label="Mobile admin navigation" className="fixed inset-x-3 bottom-3 z-50 flex items-center justify-around rounded-full bg-vessa-card/95 px-2 py-2 shadow-xl ring-1 ring-black/5 backdrop-blur-md dark:bg-vessa-darkCard/95 dark:ring-white/10 md:hidden">
        {TABS.map((tab) => {
          const Icon = TAB_ICONS[tab.id]
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-col items-center gap-0.5 rounded-full px-3 py-1 text-xs font-medium ${active ? 'text-vessa-copper dark:text-vessa-peach' : 'text-[#18201b]/70 dark:text-white/70'}`}
            >
              <Icon className="h-5 w-5" />
              {tab.label}
            </button>
          )
        })}
        <button
          type="button"
          onClick={toggleAdminTheme}
          aria-label={adminTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="flex flex-col items-center gap-0.5 rounded-full px-3 py-1 text-xs font-medium text-[#18201b]/70 dark:text-white/70"
        >
          {adminTheme === 'dark' ? <ISun className="h-5 w-5" /> : <IMoon className="h-5 w-5" />}
          Theme
        </button>
        <button
          type="button"
          onClick={handleLogout}
          className="flex flex-col items-center gap-0.5 rounded-full px-3 py-1 text-xs font-medium text-[#18201b]/70 dark:text-white/70"
        >
          <ILogout className="h-5 w-5" />
          Log out
        </button>
      </nav>

      <PaletteModal
        open={paletteOpen}
        query={paletteQuery}
        onQuery={setPaletteQuery}
        onClose={() => setPaletteOpen(false)}
        onSelectTab={(id) => {
          setActiveTab(id)
          setPaletteOpen(false)
        }}
        accounts={accounts}
        onSelectAccount={(a) => {
          setActiveTab('accounts')
          setSearch(a.business_name || '')
          setPaletteOpen(false)
        }}
      />
    </div>
  )
}
