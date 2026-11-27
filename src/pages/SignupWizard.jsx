import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { THEMES } from '../lib/store'
import SwatchStrip from '../components/SwatchStrip.jsx'

const TYPES = [
  { key: 'store', title: 'Store', desc: 'Sell products with a catalog, prices and WhatsApp orders.' },
  { key: 'freelancer', title: 'Freelancer', desc: 'Showcase your work with a portfolio of projects.' },
  { key: 'influencer', title: 'Influencer', desc: 'One page with all your social and bio links.' }
]

const STEP_TITLES = ['Account type', 'Your details', 'Theme & colour', 'First items']

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

export default function SignupWizard() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [type, setType] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [slugStatus, setSlugStatus] = useState('idle') // idle | checking | available | taken | error
  const [tagline, setTagline] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [theme, setTheme] = useState('lavender')
  const [accent, setAccent] = useState(THEMES.lavender.primary)
  const [items, setItems] = useState([{ name: '', price: '', description: '', url: '' }])
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [creating, setCreating] = useState(false)
  const slugTimer = useRef(null)

  // Live slug availability check (debounced) against accounts.slug.
  useEffect(() => {
    if (!slugTouched || !slug) {
      setSlugStatus('idle')
      return undefined
    }
    setSlugStatus('checking')
    slugTimer.current = setTimeout(async () => {
      if (!isSupabaseConfigured) {
        setSlugStatus('error')
        return
      }
      const { data, error } = await supabase
        .from('accounts')
        .select('id')
        .eq('slug', slug)
        .maybeSingle()
      if (error) {
        setSlugStatus('error')
        return
      }
      setSlugStatus(data ? 'taken' : 'available')
    }, 500)
    return () => clearTimeout(slugTimer.current)
  }, [slug, slugTouched])

  // Keep the accent in sync when the theme changes, unless the user picked a custom accent.
  function handleThemeChange(next) {
    setTheme(next)
    setAccent(THEMES[next]?.primary || THEMES.lavender.primary)
  }

  function validateStep(n) {
    const next = {}
    if (n === 1 && !type) next.type = 'Choose an account type to continue.'
    if (n === 2) {
      if (!businessName.trim()) next.businessName = 'Business name is required.'
      if (!slug) next.slug = 'A URL slug is required.'
      else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) next.slug = 'Use lowercase letters, numbers and dashes only.'
      else if (slugStatus === 'taken') next.slug = 'This URL is already taken. Try another one.'
      if (!whatsapp.trim()) next.whatsapp = 'WhatsApp number is required so customers can reach you.'
      if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) next.email = 'Enter a valid email address.'
      if (password.length < 6) next.password = 'Password must be at least 6 characters.'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function nextStep() {
    if (!validateStep(step)) return
    setSubmitError('')
    setStep((s) => Math.min(4, s + 1))
  }

  function prevStep() {
    setSubmitError('')
    setStep((s) => Math.max(1, s - 1))
  }

  function updateItem(index, field, value) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)))
  }

  function addItem() {
    setItems((prev) => [...prev, { name: '', price: '', description: '', url: '' }])
  }

  function removeItem(index) {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)))
  }

  async function handleCreate(e) {
    e.preventDefault()
    setSubmitError('')
    if (!isSupabaseConfigured) {
      setSubmitError('Supabase is not connected yet. Connect Supabase to enable signup.')
      return
    }
    if (!validateStep(2)) {
      setStep(2)
      return
    }
    setCreating(true)
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password
      })
      if (signUpError) {
        setSubmitError(signUpError.message)
        return
      }
      const user = data?.user
      if (!user) {
        setSubmitError('Signup did not return a user. Please check your email to confirm your account, then log in.')
        return
      }

      const { data: account, error: insertError } = await supabase
        .from('accounts')
        .insert({
          user_id: user.id,
          email: email.trim(),
          type,
          business_name: businessName.trim(),
          slug,
          tagline: tagline.trim(),
          whatsapp: whatsapp.trim(),
          theme,
          accent,
          plan: 'free',
          status: 'pending',
          last_active_at: new Date().toISOString(),
          social_links: [],
          settings: {}
        })
        .select('id')
        .single()
      if (insertError) {
        setSubmitError('Account could not be created: ' + insertError.message)
        return
      }

      // Optional first items, depending on account type.
      const filled = items.filter((item) => item.name.trim())
      if (filled.length > 0 && account) {
        if (type === 'store') {
          const rows = filled.map((item, i) => ({
            account_id: account.id,
            name: item.name.trim(),
            price: Number(item.price) || 0,
            description: item.description.trim(),
            sort_order: i
          }))
          const { error } = await supabase.from('products').insert(rows)
          if (error) console.error('First products could not be saved:', error.message)
        } else if (type === 'freelancer') {
          const rows = filled.map((item, i) => ({
            account_id: account.id,
            title: item.name.trim(),
            description: item.description.trim(),
            link: item.url.trim() || null,
            sort_order: i
          }))
          const { error } = await supabase.from('projects').insert(rows)
          if (error) console.error('First projects could not be saved:', error.message)
        } else {
          const rows = filled.map((item, i) => ({
            account_id: account.id,
            platform: item.name.trim(),
            label: item.name.trim(),
            url: item.url.trim(),
            sort_order: i
          }))
          const { error } = await supabase.from('bio_links').insert(rows)
          if (error) console.error('First links could not be saved:', error.message)
        }
      }

      navigate('/dashboard', { replace: true })
    } finally {
      setCreating(false)
    }
  }

  const itemLabel = type === 'store' ? 'product' : type === 'freelancer' ? 'project' : 'link'
  const themePreview = THEMES[theme] || THEMES.lavender

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="font-display text-3xl text-ink dark:text-white">Create your page</h1>
      <p className="mt-2 text-sm text-muted dark:text-brand-200">
        Step {step} of 4 — {STEP_TITLES[step - 1]}
      </p>

      {/* Step indicator */}
      <ol className="mt-6 flex gap-2">
        {STEP_TITLES.map((title, i) => (
          <li
            key={title}
            className={`flex-1 rounded-full px-3 py-2 text-center text-xs font-medium ${
              i + 1 === step
                ? 'bg-brand-600 text-white'
                : i + 1 < step
                  ? 'bg-brand-200 text-brand-800 dark:bg-night-border dark:text-brand-200'
                  : 'bg-white text-muted dark:bg-night-card dark:text-brand-200'
            }`}
          >
            {i + 1}. {title}
          </li>
        ))}
      </ol>

      {!isSupabaseConfigured && (
        <p className="mt-6 rounded-xl bg-brand-100 px-4 py-3 text-sm text-brand-800 dark:bg-night-border dark:text-brand-200">
          Connect Supabase to enable this. Signup is unavailable until the project is connected.
        </p>
      )}
      {submitError && (
        <p role="alert" className="mt-6 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-200">
          {submitError}
        </p>
      )}

      <form onSubmit={handleCreate} className="mt-6 rounded-2xl bg-white p-6 shadow-card dark:bg-night-card sm:p-8">
        {step === 1 && (
          <div>
            <p className="font-medium text-ink dark:text-white">What kind of page do you need?</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {TYPES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => {
                    setType(t.key)
                    setErrors((prev) => ({ ...prev, type: undefined }))
                  }}
                  aria-pressed={type === t.key}
                  className={`rounded-2xl border-2 p-4 text-left transition ${
                    type === t.key
                      ? 'border-brand-600 bg-brand-50 dark:bg-night-bg1'
                      : 'border-brand-200 bg-white hover:border-brand-400 dark:border-night-border dark:bg-night-bg1'
                  }`}
                >
                  <span className="block font-display text-lg text-ink dark:text-white">{t.title}</span>
                  <span className="mt-1 block text-sm text-muted dark:text-brand-200">{t.desc}</span>
                </button>
              ))}
            </div>
            {errors.type && <p className="mt-3 text-sm text-rose-600">{errors.type}</p>}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label htmlFor="sw-business" className="block text-sm font-medium text-ink dark:text-white">Business / display name</label>
              <input
                id="sw-business"
                value={businessName}
                onChange={(e) => {
                  setBusinessName(e.target.value)
                  if (!slugTouched) setSlug(slugify(e.target.value))
                }}
                placeholder="e.g. Zyam Store"
                className="mt-1 w-full rounded-xl border border-brand-200 bg-white px-4 py-2.5 text-ink outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-300 dark:border-night-border dark:bg-night-bg1 dark:text-white"
              />
              {errors.businessName && <p className="mt-1 text-sm text-rose-600">{errors.businessName}</p>}
            </div>
            <div>
              <label htmlFor="sw-slug" className="block text-sm font-medium text-ink dark:text-white">Page URL slug</label>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-sm text-muted dark:text-brand-200">zyamweb.app/s/</span>
                <input
                  id="sw-slug"
                  value={slug}
                  onChange={(e) => {
                    setSlugTouched(true)
                    setSlug(slugify(e.target.value))
                  }}
                  placeholder="your-name"
                  className="w-full rounded-xl border border-brand-200 bg-white px-4 py-2.5 text-ink outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-300 dark:border-night-border dark:bg-night-bg1 dark:text-white"
                />
              </div>
              {slugStatus === 'checking' && <p className="mt-1 text-sm text-muted">Checking availability…</p>}
              {slugStatus === 'available' && <p className="mt-1 text-sm text-emerald-600">This URL is available.</p>}
              {slugStatus === 'taken' && <p className="mt-1 text-sm text-rose-600">This URL is already taken.</p>}
              {slugStatus === 'error' && <p className="mt-1 text-sm text-rose-600">Could not check availability right now. Try again.</p>}
              {errors.slug && <p className="mt-1 text-sm text-rose-600">{errors.slug}</p>}
            </div>
            <div>
              <label htmlFor="sw-tagline" className="block text-sm font-medium text-ink dark:text-white">Tagline</label>
              <input
                id="sw-tagline"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="One short line about what you do"
                className="mt-1 w-full rounded-xl border border-brand-200 bg-white px-4 py-2.5 text-ink outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-300 dark:border-night-border dark:bg-night-bg1 dark:text-white"
              />
            </div>
            <div>
              <label htmlFor="sw-whatsapp" className="block text-sm font-medium text-ink dark:text-white">WhatsApp number</label>
              <input
                id="sw-whatsapp"
                type="tel"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="03xx xxxxxxx"
                className="mt-1 w-full rounded-xl border border-brand-200 bg-white px-4 py-2.5 text-ink outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-300 dark:border-night-border dark:bg-night-bg1 dark:text-white"
              />
              {errors.whatsapp && <p className="mt-1 text-sm text-rose-600">{errors.whatsapp}</p>}
            </div>
            <div>
              <label htmlFor="sw-email" className="block text-sm font-medium text-ink dark:text-white">Email</label>
              <input
                id="sw-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-1 w-full rounded-xl border border-brand-200 bg-white px-4 py-2.5 text-ink outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-300 dark:border-night-border dark:bg-night-bg1 dark:text-white"
              />
              {errors.email && <p className="mt-1 text-sm text-rose-600">{errors.email}</p>}
            </div>
            <div>
              <label htmlFor="sw-password" className="block text-sm font-medium text-ink dark:text-white">Password</label>
              <input
                id="sw-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="mt-1 w-full rounded-xl border border-brand-200 bg-white px-4 py-2.5 text-ink outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-300 dark:border-night-border dark:bg-night-bg1 dark:text-white"
              />
              {errors.password && <p className="mt-1 text-sm text-rose-600">{errors.password}</p>}
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <p className="font-medium text-ink dark:text-white">Pick a theme for your page</p>
            <div className="mt-4">
              <SwatchStrip value={theme} onChange={handleThemeChange} />
            </div>
            <div className="mt-4">
              <label htmlFor="sw-accent" className="block text-sm font-medium text-ink dark:text-white">Accent colour</label>
              <div className="mt-2 flex items-center gap-3">
                <input
                  id="sw-accent"
                  type="color"
                  value={accent}
                  onChange={(e) => setAccent(e.target.value)}
                  className="h-10 w-14 cursor-pointer rounded-lg border border-brand-200 bg-white dark:border-night-border"
                />
                <span className="text-sm text-muted dark:text-brand-200">{accent}</span>
              </div>
            </div>
            <div
              className="mt-6 rounded-2xl p-5"
              style={{ backgroundColor: themePreview.soft }}
            >
              <p className="font-display text-xl" style={{ color: accent }}>{businessName || 'Your business'}</p>
              <p className="mt-1 text-sm text-ink/70">{tagline || 'Your tagline will appear here.'}</p>
              <span
                className="mt-4 inline-block rounded-full px-4 py-2 text-sm font-medium text-white"
                style={{ backgroundColor: accent }}
              >
                Preview button
              </span>
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <p className="font-medium text-ink dark:text-white">
              Add your first {type === 'store' ? 'products' : type === 'freelancer' ? 'projects' : 'links'} <span className="font-normal text-muted">(optional)</span>
            </p>
            <p className="mt-1 text-sm text-muted dark:text-brand-200">
              You can skip this and add {type === 'store' ? 'products' : type === 'freelancer' ? 'projects' : 'links'} later from your dashboard.
            </p>
            <div className="mt-4 space-y-4">
              {items.map((item, i) => (
                <div key={i} className="rounded-2xl border border-brand-200 p-4 dark:border-night-border">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-ink dark:text-white">
                      {itemLabel} {i + 1}
                    </span>
                    {items.length > 1 && (
                      <button type="button" onClick={() => removeItem(i)} className="text-sm text-rose-600 hover:underline">
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="mt-3 space-y-3">
                    <input
                      value={item.name}
                      onChange={(e) => updateItem(i, 'name', e.target.value)}
                      placeholder={type === 'influencer' ? 'Platform (e.g. Instagram)' : 'Name / title'}
                      aria-label={`${itemLabel} ${i + 1} name`}
                      className="w-full rounded-xl border border-brand-200 bg-white px-4 py-2.5 text-ink outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-300 dark:border-night-border dark:bg-night-bg1 dark:text-white"
                    />
                    {type === 'store' && (
                      <input
                        value={item.price}
                        onChange={(e) => updateItem(i, 'price', e.target.value)}
                        placeholder="Price (Rs)"
                        inputMode="decimal"
                        aria-label={`Product ${i + 1} price`}
                        className="w-full rounded-xl border border-brand-200 bg-white px-4 py-2.5 text-ink outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-300 dark:border-night-border dark:bg-night-bg1 dark:text-white"
                      />
                    )}
                    {type !== 'influencer' && (
                      <input
                        value={item.description}
                        onChange={(e) => updateItem(i, 'description', e.target.value)}
                        placeholder="Short description"
                        aria-label={`${itemLabel} ${i + 1} description`}
                        className="w-full rounded-xl border border-brand-200 bg-white px-4 py-2.5 text-ink outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-300 dark:border-night-border dark:bg-night-bg1 dark:text-white"
                      />
                    )}
                    {type !== 'store' && (
                      <input
                        value={item.url}
                        onChange={(e) => updateItem(i, 'url', e.target.value)}
                        placeholder="https://…"
                        inputMode="url"
                        aria-label={`${itemLabel} ${i + 1} link`}
                        className="w-full rounded-xl border border-brand-200 bg-white px-4 py-2.5 text-ink outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-300 dark:border-night-border dark:bg-night-bg1 dark:text-white"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addItem}
              className="mt-4 rounded-full border border-brand-600 px-5 py-2 text-sm font-medium text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-night-bg1"
            >
              + Add another {itemLabel}
            </button>
          </div>
        )}

        <div className="mt-8 flex items-center justify-between gap-3">
          {step > 1 ? (
            <button
              type="button"
              onClick={prevStep}
              className="rounded-full border border-brand-300 px-6 py-2.5 font-medium text-ink hover:bg-brand-50 dark:border-night-border dark:text-white dark:hover:bg-night-bg1"
            >
              Back
            </button>
          ) : (
            <Link to="/" className="rounded-full px-6 py-2.5 font-medium text-muted hover:underline dark:text-brand-200">
              Cancel
            </Link>
          )}
          {step < 4 ? (
            <button
              type="button"
              onClick={nextStep}
              disabled={!isSupabaseConfigured}
              className="rounded-full bg-brand-600 px-6 py-2.5 font-medium text-white shadow-pill transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          ) : (
            <button
              type="submit"
              disabled={creating || !isSupabaseConfigured}
              className="rounded-full bg-brand-600 px-6 py-2.5 font-medium text-white shadow-pill transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creating ? 'Creating your page…' : 'Create my page'}
            </button>
          )}
        </div>
        <p className="mt-4 text-center text-sm text-muted dark:text-brand-200">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
            Log in
          </Link>
        </p>
      </form>
    </div>
  )
}
