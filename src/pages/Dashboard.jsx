import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { FREEZE_DAYS, PLANS, THEMES, daysSince, formatPKR, whatsappLink } from '../lib/store'
import SwatchStrip from '../components/SwatchStrip.jsx'

const inputCls =
  'w-full rounded-xl border border-brand-200 bg-white px-4 py-2.5 text-ink outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-300 dark:border-night-border dark:bg-night-bg1 dark:text-white'

function emptyItem(type) {
  if (type === 'store') return { name: '', price: '', description: '', image_url: '', video_link: '' }
  if (type === 'freelancer') return { title: '', description: '', image_url: '', link: '' }
  return { platform: '', label: '', url: '', style: 'default' }
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [checkingSession, setCheckingSession] = useState(true)
  const [account, setAccount] = useState(null)
  const [items, setItems] = useState([])
  const [loadError, setLoadError] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [savingItem, setSavingItem] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [upgradeSent, setUpgradeSent] = useState(false)
  const [upgrading, setUpgrading] = useState(false)
  const fileInputRef = useRef(null)

  // Settings form state (mirrors the accounts row).
  const [settings, setSettings] = useState({
    business_name: '',
    tagline: '',
    description: '',
    whatsapp: '',
    theme: 'lavender',
    accent: '',
    social_links: []
  })
  const [socialDraft, setSocialDraft] = useState({ label: '', url: '' })

  const itemTable = account?.type === 'store' ? 'products' : account?.type === 'freelancer' ? 'projects' : 'bio_links'
  const itemLabel = account?.type === 'store' ? 'product' : account?.type === 'freelancer' ? 'project' : 'link'

  const loadItems = useCallback(async (accountId, table) => {
    const { data, error: itemsError } = await supabase
      .from(table)
      .select('*')
      .eq('account_id', accountId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
    if (itemsError) {
      setLoadError('Could not load your items: ' + itemsError.message)
      return
    }
    setItems(data || [])
  }, [])

  useEffect(() => {
    async function init() {
      if (!isSupabaseConfigured) {
        setCheckingSession(false)
        setLoadError('Supabase is not connected yet. Connect Supabase to enable the dashboard.')
        return
      }
      const { data } = await supabase.auth.getSession()
      if (!data?.session) {
        navigate('/login', { replace: true })
        return
      }
      const user = data.session.user
      const { data: accountRow, error: accountError } = await supabase
        .from('accounts')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()
      if (accountError) {
        setLoadError('Could not load your account: ' + accountError.message)
        setCheckingSession(false)
        return
      }
      if (!accountRow) {
        setLoadError('No Zyam Web account is linked to this login yet. Please finish signing up first.')
        setCheckingSession(false)
        return
      }
      setAccount(accountRow)
      setSettings({
        business_name: accountRow.business_name || '',
        tagline: accountRow.tagline || '',
        description: accountRow.description || '',
        whatsapp: accountRow.whatsapp || '',
        theme: accountRow.theme || 'lavender',
        accent: accountRow.accent || (THEMES[accountRow.theme]?.primary ?? THEMES.lavender.primary),
        social_links: Array.isArray(accountRow.social_links) ? accountRow.social_links : []
      })
      const table = accountRow.type === 'store' ? 'products' : accountRow.type === 'freelancer' ? 'projects' : 'bio_links'
      await loadItems(accountRow.id, table)
      setCheckingSession(false)
    }
    init()
  }, [navigate, loadItems])

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/', { replace: true })
  }

  async function handleUpgrade() {
    if (!account) return
    setError('')
    setUpgrading(true)
    try {
      const { error: insertError } = await supabase.from('support_messages').insert({
        account_id: account.id,
        name: account.business_name || '',
        email: account.email || '',
        message: 'Upgrade request to Paid plan',
        status: 'open'
      })
      if (insertError) {
        setError('Upgrade request could not be sent: ' + insertError.message)
        return
      }
      setUpgradeSent(true)
      setNotice('Upgrade request sent. The Zyam Web team will contact you to complete payment for the Paid plan.')
    } finally {
      setUpgrading(false)
    }
  }

  function startAdd() {
    setForm(emptyItem(account.type))
    setEditingId(null)
    setError('')
  }

  function startEdit(item) {
    setForm({ ...item })
    setEditingId(item.id)
    setError('')
  }

  function cancelEdit() {
    setForm(null)
    setEditingId(null)
  }

  async function uploadImage(file) {
    if (!file || !account) return
    setUploading(true)
    setError('')
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `${account.id}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('catalog-images')
        .upload(path, file, { upsert: false })
      if (uploadError) {
        setError('Image upload failed: ' + uploadError.message)
        return
      }
      const { data } = supabase.storage.from('catalog-images').getPublicUrl(path)
      setForm((prev) => (prev ? { ...prev, image_url: data.publicUrl } : prev))
      setNotice('Image uploaded.')
    } finally {
      setUploading(false)
    }
  }

  async function saveItem(e) {
    e.preventDefault()
    if (!form || !account) return
    setError('')
    setNotice('')
    // Validation per type.
    if (account.type === 'store' && !form.name?.trim()) return setError('Product name is required.')
    if (account.type === 'freelancer' && !form.title?.trim()) return setError('Project title is required.')
    if (account.type === 'influencer' && (!form.label?.trim() || !form.url?.trim())) {
      return setError('Link label and URL are both required.')
    }
    setSavingItem(true)
    try {
      let payload
      if (account.type === 'store') {
        payload = {
          account_id: account.id,
          name: form.name.trim(),
          price: Number(form.price) || 0,
          description: (form.description || '').trim(),
          image_url: form.image_url || null,
          video_link: (form.video_link || '').trim() || null
        }
      } else if (account.type === 'freelancer') {
        payload = {
          account_id: account.id,
          title: form.title.trim(),
          description: (form.description || '').trim(),
          image_url: form.image_url || null,
          link: (form.link || '').trim() || null
        }
      } else {
        payload = {
          account_id: account.id,
          platform: (form.platform || form.label || '').trim(),
          label: form.label.trim(),
          url: form.url.trim(),
          style: form.style || 'default'
        }
      }
      let result
      if (editingId) {
        result = await supabase.from(itemTable).update(payload).eq('id', editingId).select().single()
      } else {
        result = await supabase
          .from(itemTable)
          .insert({ ...payload, sort_order: items.length })
          .select()
          .single()
      }
      if (result.error) {
        setError('Could not save: ' + result.error.message)
        return
      }
      await loadItems(account.id, itemTable)
      setForm(null)
      setEditingId(null)
      setNotice(editingId ? 'Item updated.' : 'Item added.')
    } finally {
      setSavingItem(false)
    }
  }

  async function deleteItem(id) {
    if (!window.confirm('Delete this item? This cannot be undone.')) return
    const { error: deleteError } = await supabase.from(itemTable).delete().eq('id', id)
    if (deleteError) {
      setError('Could not delete: ' + deleteError.message)
      return
    }
    await loadItems(account.id, itemTable)
    setNotice('Item deleted.')
  }

  async function saveSettings(e) {
    e.preventDefault()
    if (!account) return
    setError('')
    setNotice('')
    if (!settings.business_name.trim()) return setError('Business name is required.')
    setSavingSettings(true)
    try {
      const { data, error: updateError } = await supabase
        .from('accounts')
        .update({
          business_name: settings.business_name.trim(),
          tagline: settings.tagline.trim(),
          description: settings.description.trim(),
          whatsapp: settings.whatsapp.trim(),
          theme: settings.theme,
          accent: settings.accent || null,
          social_links: settings.social_links
        })
        .eq('id', account.id)
        .select()
        .single()
      if (updateError) {
        setError('Settings could not be saved: ' + updateError.message)
        return
      }
      setAccount(data)
      setNotice('Settings saved.')
    } finally {
      setSavingSettings(false)
    }
  }

  function addSocialLink() {
    if (!socialDraft.label.trim() || !socialDraft.url.trim()) {
      setError('Enter both a label and a URL for the social link.')
      return
    }
    setSettings((prev) => ({
      ...prev,
      social_links: [...prev.social_links, { label: socialDraft.label.trim(), url: socialDraft.url.trim() }]
    }))
    setSocialDraft({ label: '', url: '' })
    setError('')
  }

  function removeSocialLink(index) {
    setSettings((prev) => ({
      ...prev,
      social_links: prev.social_links.filter((_, i) => i !== index)
    }))
  }

  if (checkingSession) {
    return <p className="mx-auto max-w-5xl px-4 py-16 text-muted">Loading your dashboard…</p>
  }

  if (!account) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <div className="rounded-2xl bg-white p-8 shadow-card dark:bg-night-card">
          <h1 className="font-display text-2xl text-ink dark:text-white">Dashboard unavailable</h1>
          <p className="mt-3 text-sm text-muted dark:text-brand-200">{loadError || 'Could not load your account.'}</p>
          <Link to="/login" className="mt-6 inline-block rounded-full bg-brand-600 px-6 py-2.5 font-medium text-white">
            Go to login
          </Link>
        </div>
      </div>
    )
  }

  const inactiveDays = daysSince(account.last_active_at)
  const daysRemaining = account.plan === 'free' ? Math.max(0, FREEZE_DAYS - inactiveDays) : null
  const plan = PLANS[account.plan] || PLANS.free
  const publicUrl = `/s/${account.slug}`
  const wa = whatsappLink(account.whatsapp, `Hi ${account.business_name}!`)

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-ink dark:text-white">{account.business_name}</h1>
          <p className="mt-1 text-sm text-muted dark:text-brand-200">
            {account.type === 'store' ? 'Store' : account.type === 'freelancer' ? 'Freelancer' : 'Influencer'} ·{' '}
            <Link to={publicUrl} target="_blank" rel="noreferrer" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
              View public page ↗
            </Link>
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="rounded-full border border-brand-300 px-5 py-2.5 font-medium text-ink hover:bg-white dark:border-night-border dark:text-white dark:hover:bg-night-card"
        >
          Log out
        </button>
      </div>

      {!isSupabaseConfigured && (
        <p className="mt-6 rounded-xl bg-brand-100 px-4 py-3 text-sm text-brand-800 dark:bg-night-border dark:text-brand-200">
          Connect Supabase to enable this. Dashboard actions are unavailable until the project is connected.
        </p>
      )}
      {loadError && (
        <p className="mt-6 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-200">{loadError}</p>
      )}
      {error && (
        <p role="alert" className="mt-6 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-200">{error}</p>
      )}
      {notice && (
        <p className="mt-6 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200">{notice}</p>
      )}

      {/* Status + plan cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-white p-6 shadow-card dark:bg-night-card">
          <h2 className="font-display text-xl text-ink dark:text-white">Account status</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted dark:text-brand-200">Status</dt>
              <dd className="font-medium capitalize text-ink dark:text-white">{account.status}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted dark:text-brand-200">Plan</dt>
              <dd className="font-medium text-ink dark:text-white">{plan.name}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted dark:text-brand-200">Last active</dt>
              <dd className="font-medium text-ink dark:text-white">
                {account.last_active_at ? new Date(account.last_active_at).toLocaleDateString('en-PK', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
                {inactiveDays > 0 ? ` (${inactiveDays} day${inactiveDays === 1 ? '' : 's'} ago)` : ' (today)'}
              </dd>
            </div>
            {daysRemaining !== null && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted dark:text-brand-200">Freeze in</dt>
                <dd className="font-medium text-ink dark:text-white">
                  {account.status === 'frozen'
                    ? 'Frozen — log in again to reactivate'
                    : `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining before the ${FREEZE_DAYS}-day freeze`}
                </dd>
              </div>
            )}
            {account.plan === 'paid' && (
              <p className="pt-1 text-sm text-emerald-600">Paid accounts never freeze.</p>
            )}
          </dl>
          {account.status === 'pending' && (
            <p className="mt-4 rounded-xl bg-brand-100 px-4 py-3 text-sm text-brand-800 dark:bg-night-border dark:text-brand-200">
              Your account is pending approval. Your public page will be visible once it is approved.
            </p>
          )}
          {account.status === 'frozen' && (
            <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-200">
              Your account is frozen for inactivity. Logging in again reactivates it — if this page still shows frozen, log out and log back in.
            </p>
          )}
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-card dark:bg-night-card">
          <h2 className="font-display text-xl text-ink dark:text-white">Your plan</h2>
          {account.plan === 'free' ? (
            <>
              <p className="mt-4 text-sm text-muted dark:text-brand-200">
                You are on the <strong className="text-ink dark:text-white">Free</strong> plan.
              </p>
              <p className="mt-2 text-sm text-muted dark:text-brand-200">
                Paid plan: <span className="line-through">{formatPKR(PLANS.paid.price)}</span>{' '}
                <strong className="text-ink dark:text-white">{formatPKR(PLANS.paid.offer)} / year</strong> — removes the
                “Made with Zyam Web” footer and your page never freezes.
              </p>
              {upgradeSent ? (
                <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200">
                  Upgrade request sent. The Zyam Web team will contact you to complete payment.
                </p>
              ) : (
                <button
                  onClick={handleUpgrade}
                  disabled={upgrading || !isSupabaseConfigured}
                  className="mt-4 rounded-full bg-brand-600 px-6 py-2.5 font-medium text-white shadow-pill transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {upgrading ? 'Sending…' : `Upgrade to Paid — ${formatPKR(PLANS.paid.offer)}/year`}
                </button>
              )}
            </>
          ) : (
            <p className="mt-4 text-sm text-muted dark:text-brand-200">
              You are on the <strong className="text-ink dark:text-white">Paid</strong> plan ({formatPKR(PLANS.paid.offer)}/year).
              Your page has no “Made with Zyam Web” footer and never freezes.
            </p>
          )}
          <p className="mt-4 text-sm">
            Public page:{' '}
            <Link to={publicUrl} target="_blank" rel="noreferrer" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
              /s/{account.slug} ↗
            </Link>
          </p>
          {wa && (
            <p className="mt-1 text-sm">
              WhatsApp:{' '}
              <a href={wa} target="_blank" rel="noreferrer" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
                Open chat ↗
              </a>
            </p>
          )}
        </div>
      </div>

      {/* Items CRUD */}
      <section className="mt-8 rounded-2xl bg-white p-6 shadow-card dark:bg-night-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl text-ink dark:text-white">
            {account.type === 'store' ? 'Products' : account.type === 'freelancer' ? 'Projects' : 'Bio links'} ({items.length})
          </h2>
          {!form && (
            <button
              onClick={startAdd}
              className="rounded-full bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              + Add {itemLabel}
            </button>
          )}
        </div>

        {form && (
          <form onSubmit={saveItem} className="mt-5 space-y-4 rounded-2xl border border-brand-200 p-4 dark:border-night-border">
            <p className="font-medium text-ink dark:text-white">{editingId ? `Edit ${itemLabel}` : `New ${itemLabel}`}</p>
            {account.type === 'store' && (
              <>
                <input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Product name" aria-label="Product name" className={inputCls} />
                <input value={form.price ?? ''} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="Price (Rs)" inputMode="decimal" aria-label="Price" className={inputCls} />
                <textarea value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" rows={2} aria-label="Description" className={inputCls} />
              </>
            )}
            {account.type === 'freelancer' && (
              <>
                <input value={form.title || ''} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Project title" aria-label="Project title" className={inputCls} />
                <textarea value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" rows={2} aria-label="Description" className={inputCls} />
                <input value={form.link || ''} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="Project link (https://…)" inputMode="url" aria-label="Project link" className={inputCls} />
              </>
            )}
            {account.type === 'influencer' && (
              <>
                <input value={form.platform || ''} onChange={(e) => setForm({ ...form, platform: e.target.value })} placeholder="Platform (e.g. Instagram)" aria-label="Platform" className={inputCls} />
                <input value={form.label || ''} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Link label" aria-label="Link label" className={inputCls} />
                <input value={form.url || ''} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="URL (https://…)" inputMode="url" aria-label="Link URL" className={inputCls} />
              </>
            )}
            {account.type !== 'influencer' && (
              <div>
                <label className="block text-sm font-medium text-ink dark:text-white">Image</label>
                {form.image_url && (
                  <img src={form.image_url} alt="Item preview" className="mt-2 h-24 w-24 rounded-xl object-cover" />
                )}
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) uploadImage(file)
                      e.target.value = ''
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="rounded-full border border-brand-600 px-5 py-2 text-sm font-medium text-brand-600 hover:bg-brand-50 disabled:opacity-50 dark:text-brand-400 dark:hover:bg-night-bg1"
                  >
                    {uploading ? 'Uploading…' : form.image_url ? 'Replace image' : 'Upload image'}
                  </button>
                  <input
                    value={form.image_url || ''}
                    onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                    placeholder="…or paste an image URL"
                    aria-label="Image URL"
                    className="min-w-0 flex-1 rounded-xl border border-brand-200 bg-white px-4 py-2 text-sm text-ink outline-none focus:border-brand-600 dark:border-night-border dark:bg-night-bg1 dark:text-white"
                  />
                </div>
              </div>
            )}
            {account.type === 'store' && (
              <input
                value={form.video_link || ''}
                onChange={(e) => setForm({ ...form, video_link: e.target.value })}
                placeholder="Video link (YouTube / TikTok URL — link only, no upload)"
                inputMode="url"
                aria-label="Video link"
                className={inputCls}
              />
            )}
            <div className="flex gap-3">
              <button type="submit" disabled={savingItem} className="rounded-full bg-brand-600 px-6 py-2.5 font-medium text-white hover:bg-brand-700 disabled:opacity-50">
                {savingItem ? 'Saving…' : 'Save'}
              </button>
              <button type="button" onClick={cancelEdit} className="rounded-full border border-brand-300 px-6 py-2.5 font-medium text-ink dark:border-night-border dark:text-white">
                Cancel
              </button>
            </div>
          </form>
        )}

        {items.length === 0 ? (
          <p className="mt-5 text-sm text-muted dark:text-brand-200">
            No {account.type === 'store' ? 'products' : account.type === 'freelancer' ? 'projects' : 'bio links'} yet. Add your first one above.
          </p>
        ) : (
          <ul className="mt-5 divide-y divide-brand-100 dark:divide-night-border">
            {items.map((item) => (
              <li key={item.id} className="flex items-center gap-4 py-3">
                {item.image_url && <img src={item.image_url} alt="" className="h-12 w-12 rounded-lg object-cover" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink dark:text-white">
                    {account.type === 'store' ? item.name : account.type === 'freelancer' ? item.title : item.label}
                  </p>
                  <p className="truncate text-sm text-muted dark:text-brand-200">
                    {account.type === 'store'
                      ? formatPKR(item.price)
                      : account.type === 'freelancer'
                        ? item.link || item.description || ''
                        : item.url}
                  </p>
                </div>
                <button onClick={() => startEdit(item)} className="rounded-full border border-brand-300 px-4 py-1.5 text-sm font-medium text-ink hover:bg-brand-50 dark:border-night-border dark:text-white dark:hover:bg-night-bg1">
                  Edit
                </button>
                <button onClick={() => deleteItem(item.id)} className="rounded-full border border-rose-300 px-4 py-1.5 text-sm font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950">
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Store settings */}
      <section className="mt-8 rounded-2xl bg-white p-6 shadow-card dark:bg-night-card">
        <h2 className="font-display text-xl text-ink dark:text-white">Page settings</h2>
        <form onSubmit={saveSettings} className="mt-5 space-y-4">
          <div>
            <label htmlFor="dash-business" className="block text-sm font-medium text-ink dark:text-white">Business / display name</label>
            <input id="dash-business" value={settings.business_name} onChange={(e) => setSettings({ ...settings, business_name: e.target.value })} className={`${inputCls} mt-1`} />
          </div>
          <div>
            <label htmlFor="dash-tagline" className="block text-sm font-medium text-ink dark:text-white">Tagline</label>
            <input id="dash-tagline" value={settings.tagline} onChange={(e) => setSettings({ ...settings, tagline: e.target.value })} className={`${inputCls} mt-1`} />
          </div>
          <div>
            <label htmlFor="dash-desc" className="block text-sm font-medium text-ink dark:text-white">Description</label>
            <textarea id="dash-desc" value={settings.description} onChange={(e) => setSettings({ ...settings, description: e.target.value })} rows={3} className={`${inputCls} mt-1`} />
          </div>
          <div>
            <label htmlFor="dash-whatsapp" className="block text-sm font-medium text-ink dark:text-white">WhatsApp number</label>
            <input id="dash-whatsapp" type="tel" value={settings.whatsapp} onChange={(e) => setSettings({ ...settings, whatsapp: e.target.value })} className={`${inputCls} mt-1`} />
          </div>
          <div>
            <span className="block text-sm font-medium text-ink dark:text-white">Theme</span>
            <div className="mt-2">
              <SwatchStrip
                value={settings.theme}
                onChange={(next) => setSettings((prev) => ({
                  ...prev,
                  theme: next,
                  accent: THEMES[next]?.primary || prev.accent
                }))}
              />
            </div>
          </div>
          <div>
            <label htmlFor="dash-accent" className="block text-sm font-medium text-ink dark:text-white">Accent colour</label>
            <div className="mt-2 flex items-center gap-3">
              <input
                id="dash-accent"
                type="color"
                value={settings.accent || THEMES[settings.theme]?.primary || '#7C3AED'}
                onChange={(e) => setSettings({ ...settings, accent: e.target.value })}
                className="h-10 w-14 cursor-pointer rounded-lg border border-brand-200 bg-white dark:border-night-border"
              />
              <span className="text-sm text-muted dark:text-brand-200">{settings.accent || 'Theme default'}</span>
            </div>
          </div>
          <div>
            <span className="block text-sm font-medium text-ink dark:text-white">Social links</span>
            {settings.social_links.length === 0 ? (
              <p className="mt-1 text-sm text-muted dark:text-brand-200">No social links yet.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {settings.social_links.map((link, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 rounded-xl bg-brand-50 px-4 py-2 text-sm dark:bg-night-bg1">
                    <a href={link.url} target="_blank" rel="noreferrer" className="min-w-0 truncate font-medium text-brand-700 hover:underline dark:text-brand-300">
                      {link.label} — {link.url}
                    </a>
                    <button type="button" onClick={() => removeSocialLink(i)} className="shrink-0 text-rose-600 hover:underline">
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                value={socialDraft.label}
                onChange={(e) => setSocialDraft({ ...socialDraft, label: e.target.value })}
                placeholder="Label (e.g. Instagram)"
                aria-label="Social link label"
                className="min-w-0 flex-1 rounded-xl border border-brand-200 bg-white px-4 py-2 text-sm text-ink outline-none focus:border-brand-600 dark:border-night-border dark:bg-night-bg1 dark:text-white"
              />
              <input
                value={socialDraft.url}
                onChange={(e) => setSocialDraft({ ...socialDraft, url: e.target.value })}
                placeholder="https://…"
                inputMode="url"
                aria-label="Social link URL"
                className="min-w-0 flex-1 rounded-xl border border-brand-200 bg-white px-4 py-2 text-sm text-ink outline-none focus:border-brand-600 dark:border-night-border dark:bg-night-bg1 dark:text-white"
              />
              <button
                type="button"
                onClick={addSocialLink}
                className="rounded-full border border-brand-600 px-5 py-2 text-sm font-medium text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-night-bg1"
              >
                Add link
              </button>
            </div>
            <p className="mt-1 text-xs text-muted dark:text-brand-200">Remember to save settings below after adding or removing links.</p>
          </div>
          <button
            type="submit"
            disabled={savingSettings}
            className="rounded-full bg-brand-600 px-6 py-2.5 font-medium text-white shadow-pill transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {savingSettings ? 'Saving…' : 'Save settings'}
          </button>
        </form>
      </section>
    </div>
  )
}
