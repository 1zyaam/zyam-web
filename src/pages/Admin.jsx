import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { PLANS, THEMES, daysSince, FREEZE_DAYS } from '../lib/store.js'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'ads', label: 'Ads' },
  { id: 'support', label: 'Support' }
]

const STATUS_STYLES = {
  pending: 'bg-brand-100 text-brand-700 dark:bg-night-border dark:text-brand-300',
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

function Card({ title, value, sub }) {
  return (
    <div className="rounded-2xl bg-white dark:bg-night-card p-5 shadow-card border border-brand-100 dark:border-night-border">
      <p className="text-sm text-muted dark:text-brand-300">{title}</p>
      <p className="mt-1 font-display text-3xl font-semibold">{value}</p>
      {sub ? <p className="mt-1 text-xs text-muted dark:text-brand-300">{sub}</p> : null}
    </div>
  )
}

export default function Admin() {
  const navigate = useNavigate()

  // ---- Gate state ----
  const [gate, setGate] = useState('checking') // 'checking' | 'gate' | 'admin'
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

  // Accounts tab filters
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  // Ads tab form state
  const [newAd, setNewAd] = useState({ title: '', placement: 'storefront-top', budget: '' })
  const [editingId, setEditingId] = useState(null)
  const [editAd, setEditAd] = useState({ title: '', placement: '', budget: '' })
  const [savingAd, setSavingAd] = useState(false)

  // ---- Gate: verify a signed-in user is the admin ----
  async function verifyAdmin(user) {
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
    setGate('admin')
    return true
  }

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setGate('gate')
      return
    }
    supabase.auth.getSession().then(async ({ data }) => {
      if (data?.session?.user) {
        const ok = await verifyAdmin(data.session.user)
        if (ok) loadAll()
      } else {
        setGate('gate')
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  async function loadAll() {
    setLoading(true)
    setError('')
    try {
      await Promise.all([loadOverview(), loadAccounts(), loadCampaigns(), loadMessages()])
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
      <main className="mx-auto max-w-2xl px-4 py-16">
        <div className="rounded-2xl bg-white dark:bg-night-card p-8 shadow-card border border-brand-100 dark:border-night-border text-center">
          <h1 className="font-display text-2xl font-semibold">Connect Supabase to enable this</h1>
          <p className="mt-3 text-muted dark:text-brand-300">
            The admin panel needs a Supabase project. Copy <code>.env.example</code> to <code>.env</code>,
            set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>, then run the SQL
            migrations in <code>supabase/migrations/</code>. See <code>DEPLOY.md</code> for the steps.
          </p>
          <Link to="/" className="mt-6 inline-block rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
            Back to home
          </Link>
        </div>
      </main>
    )
  }

  // ---- Render: password gate (always first) ----
  if (gate !== 'admin') {
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <div className="rounded-2xl bg-white dark:bg-night-card p-8 shadow-card border border-brand-100 dark:border-night-border">
          <h1 className="font-display text-2xl font-semibold">Admin sign in</h1>
          <p className="mt-2 text-sm text-muted dark:text-brand-300">
            This area is for the Zyam Web owner only. Sign in with the admin account.
          </p>
          {gate === 'checking' ? (
            <p className="mt-6 text-sm text-muted dark:text-brand-300">Checking your session…</p>
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
                  className="mt-1 w-full rounded-xl border border-brand-200 dark:border-night-border bg-white dark:bg-night-bg1 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-400"
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
                  className="mt-1 w-full rounded-xl border border-brand-200 dark:border-night-border bg-white dark:bg-night-bg1 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-400"
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
                className="w-full rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {signingIn ? 'Signing in…' : 'Sign in as admin'}
              </button>
            </form>
          )}
          <Link to="/" className="mt-6 inline-block text-sm text-brand-600 hover:underline">← Back to home</Link>
        </div>
      </main>
    )
  }

  // ---- Render: admin panel ----
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Admin panel</h1>
          <p className="mt-1 text-sm text-muted dark:text-brand-300">Signed in as {adminEmail}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadAll}
            className="rounded-full border border-brand-200 dark:border-night-border bg-white dark:bg-night-card px-4 py-2 text-sm font-semibold hover:bg-brand-50 dark:hover:bg-night-bg1"
          >
            Refresh
          </button>
          <button
            onClick={handleLogout}
            className="rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Log out
          </button>
        </div>
      </header>

      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-rose-50 dark:bg-rose-900/30 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">{error}</p>
      )}
      {notice && (
        <p role="status" className="mt-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">{notice}</p>
      )}

      {/* Tabs — each switches to its own content, active tab highlighted */}
      <nav className="mt-6 flex flex-wrap gap-2" aria-label="Admin sections">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            aria-current={activeTab === tab.id ? 'page' : undefined}
            className={`rounded-full px-5 py-2.5 text-sm font-semibold transition-colors ${
              activeTab === tab.id
                ? 'bg-brand-600 text-white shadow-pill'
                : 'bg-white dark:bg-night-card text-ink dark:text-white border border-brand-200 dark:border-night-border hover:bg-brand-50 dark:hover:bg-night-bg1'
            }`}
          >
            {tab.label}
            {tab.id === 'support' && openMessages > 0 ? ` (${openMessages} open)` : ''}
            {tab.id === 'accounts' && overview?.pending > 0 ? ` (${overview.pending} pending)` : ''}
          </button>
        ))}
      </nav>

      {loading && <p className="mt-8 text-sm text-muted dark:text-brand-300">Loading…</p>}

      {/* ---------- OVERVIEW ---------- */}
      {activeTab === 'overview' && overview && (
        <section className="mt-6 space-y-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Card title="Total accounts" value={overview.total} />
            <Card title="Free plan" value={overview.free} sub={`${PLANS.free.name} plan`} />
            <Card title="Paid plan" value={overview.paid} sub={`${PLANS.paid.name} plan`} />
            <Card title="Active accounts" value={overview.active} />
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Card title="Pending approval" value={overview.pending} />
            <Card title="Frozen accounts" value={overview.frozen} />
            <Card title="Rejected" value={overview.rejected} />
            <Card title="Banned" value={overview.banned} />
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Card title="Products" value={overview.products} />
            <Card title="Projects" value={overview.projects} />
            <Card title="Bio links" value={overview.links} />
            <Card title="Ad campaigns" value={overview.adCount} />
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Card title="Total ad budget" value={`Rs ${overview.adBudget.toLocaleString()}`} />
            <Card title="Total ad spend" value={`Rs ${overview.adSpend.toLocaleString()}`} />
            <Card title="Ad impressions" value={overview.adImpressions.toLocaleString()} />
            <Card title="Ad clicks" value={overview.adClicks.toLocaleString()} />
          </div>
          <p className="text-sm text-muted dark:text-brand-300">
            Free accounts freeze after {FREEZE_DAYS} days of inactivity. Re-login unfreezes them.
          </p>
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
              className="min-w-0 flex-1 rounded-xl border border-brand-200 dark:border-night-border bg-white dark:bg-night-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-400"
            />
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              aria-label="Filter by plan"
              className="rounded-xl border border-brand-200 dark:border-night-border bg-white dark:bg-night-card px-3 py-2.5 text-sm"
            >
              <option value="all">All plans</option>
              <option value="free">{PLANS.free.name}</option>
              <option value="paid">{PLANS.paid.name}</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by status"
              className="rounded-xl border border-brand-200 dark:border-night-border bg-white dark:bg-night-card px-3 py-2.5 text-sm"
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
            <p className="mt-8 rounded-2xl bg-white dark:bg-night-card p-6 text-center text-sm text-muted dark:text-brand-300 border border-brand-100 dark:border-night-border">
              No accounts match this search. Try a different search or filter.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {filteredAccounts.map((account) => {
                const inactiveDays = account.last_active_at ? daysSince(account.last_active_at) : null
                return (
                  <li key={account.id} className="rounded-2xl bg-white dark:bg-night-card p-5 shadow-card border border-brand-100 dark:border-night-border">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{account.business_name || '(No business name)'}</p>
                        <p className="text-sm text-muted dark:text-brand-300">
                          {account.email} · /s/{account.slug} · {account.type} · {THEMES[account.theme]?.name || account.theme || 'Lavender'}
                        </p>
                        <p className="mt-1 text-xs text-muted dark:text-brand-300">
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
                          className="rounded-full border border-brand-200 dark:border-night-border px-3 py-1.5 text-xs font-semibold hover:bg-brand-50 dark:hover:bg-night-bg1"
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
                        <button onClick={() => updateAccount(account.id, { plan: 'paid' }, 'Plan set to Paid.')} className="rounded-full border border-brand-300 px-3.5 py-1.5 text-xs font-semibold text-brand-700 dark:text-brand-300 hover:bg-brand-50 dark:hover:bg-night-bg1">Set plan: Paid</button>
                      ) : (
                        <button onClick={() => updateAccount(account.id, { plan: 'free' }, 'Plan set to Free.')} className="rounded-full border border-brand-300 px-3.5 py-1.5 text-xs font-semibold text-brand-700 dark:text-brand-300 hover:bg-brand-50 dark:hover:bg-night-bg1">Set plan: Free</button>
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
          <form onSubmit={createCampaign} className="rounded-2xl bg-white dark:bg-night-card p-5 shadow-card border border-brand-100 dark:border-night-border">
            <h2 className="font-display text-lg font-semibold">Create campaign</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <input
                type="text"
                required
                value={newAd.title}
                onChange={(e) => setNewAd({ ...newAd, title: e.target.value })}
                placeholder="Campaign title"
                aria-label="Campaign title"
                className="rounded-xl border border-brand-200 dark:border-night-border bg-white dark:bg-night-bg1 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-400 md:col-span-2"
              />
              <select
                value={newAd.placement}
                onChange={(e) => setNewAd({ ...newAd, placement: e.target.value })}
                aria-label="Ad placement"
                className="rounded-xl border border-brand-200 dark:border-night-border bg-white dark:bg-night-bg1 px-3 py-2.5 text-sm"
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
                className="rounded-xl border border-brand-200 dark:border-night-border bg-white dark:bg-night-bg1 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-400"
              />
            </div>
            <button
              type="submit"
              disabled={savingAd}
              className="mt-4 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {savingAd ? 'Creating…' : 'Create campaign'}
            </button>
          </form>

          {campaigns.length === 0 ? (
            <p className="rounded-2xl bg-white dark:bg-night-card p-6 text-center text-sm text-muted dark:text-brand-300 border border-brand-100 dark:border-night-border">
              No ad campaigns yet. Create one above.
            </p>
          ) : (
            <ul className="space-y-3">
              {campaigns.map((campaign) => (
                <li key={campaign.id} className="rounded-2xl bg-white dark:bg-night-card p-5 shadow-card border border-brand-100 dark:border-night-border">
                  {editingId === campaign.id ? (
                    <div className="grid gap-3 md:grid-cols-4">
                      <input
                        type="text"
                        value={editAd.title}
                        onChange={(e) => setEditAd({ ...editAd, title: e.target.value })}
                        aria-label="Edit campaign title"
                        className="rounded-xl border border-brand-200 dark:border-night-border bg-white dark:bg-night-bg1 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-400 md:col-span-2"
                      />
                      <select
                        value={editAd.placement}
                        onChange={(e) => setEditAd({ ...editAd, placement: e.target.value })}
                        aria-label="Edit placement"
                        className="rounded-xl border border-brand-200 dark:border-night-border bg-white dark:bg-night-bg1 px-3 py-2.5 text-sm"
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
                        className="rounded-xl border border-brand-200 dark:border-night-border bg-white dark:bg-night-bg1 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-400"
                      />
                      <div className="flex gap-2 md:col-span-4">
                        <button onClick={() => saveEdit(campaign.id)} disabled={savingAd} className="rounded-full bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60">Save</button>
                        <button onClick={() => setEditingId(null)} className="rounded-full border border-brand-200 dark:border-night-border px-4 py-2 text-xs font-semibold">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{campaign.title}</p>
                          <p className="text-sm text-muted dark:text-brand-300">
                            Placement: {campaign.placement} · Created {campaign.created_at ? new Date(campaign.created_at).toLocaleDateString() : '—'}
                          </p>
                        </div>
                        <StatusPill status={campaign.status === 'running' ? 'active' : 'pending'} />
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                        <p><span className="text-muted dark:text-brand-300">Budget</span><br /><strong>Rs {Number(campaign.budget || 0).toLocaleString()}</strong></p>
                        <p><span className="text-muted dark:text-brand-300">Spend</span><br /><strong>Rs {Number(campaign.spend || 0).toLocaleString()}</strong></p>
                        <p><span className="text-muted dark:text-brand-300">Impressions</span><br /><strong>{Number(campaign.impressions || 0).toLocaleString()}</strong></p>
                        <p><span className="text-muted dark:text-brand-300">Clicks</span><br /><strong>{Number(campaign.clicks || 0).toLocaleString()}</strong></p>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          onClick={() => toggleCampaign(campaign)}
                          className={`rounded-full px-4 py-2 text-xs font-semibold text-white ${campaign.status === 'running' ? 'bg-sky-600 hover:bg-sky-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                        >
                          {campaign.status === 'running' ? 'Pause' : 'Start'}
                        </button>
                        <button onClick={() => startEdit(campaign)} className="rounded-full border border-brand-200 dark:border-night-border px-4 py-2 text-xs font-semibold hover:bg-brand-50 dark:hover:bg-night-bg1">Edit</button>
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
            <p className="rounded-2xl bg-white dark:bg-night-card p-6 text-center text-sm text-muted dark:text-brand-300 border border-brand-100 dark:border-night-border">
              No support messages yet. Messages from the landing-page contact form and plan-upgrade requests will appear here.
            </p>
          ) : (
            <ul className="space-y-3">
              {messages.map((message) => (
                <li key={message.id} className="rounded-2xl bg-white dark:bg-night-card p-5 shadow-card border border-brand-100 dark:border-night-border">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{message.name || '(No name)'} <span className="font-normal text-muted dark:text-brand-300">· {message.email || 'no email'}</span></p>
                      <p className="text-xs text-muted dark:text-brand-300">
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
                      <button onClick={() => setMessageStatus(message.id, 'open')} className="rounded-full border border-brand-200 dark:border-night-border px-4 py-2 text-xs font-semibold hover:bg-brand-50 dark:hover:bg-night-bg1">Reopen</button>
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
  )
}
