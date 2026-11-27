import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { THEMES, formatPKR, getAccountBySlug, whatsappLink } from '../lib/store'

const UNAVAILABLE = ['pending', 'frozen', 'rejected', 'banned']

export default function Storefront() {
  const { slug } = useParams()
  const [account, setAccount] = useState(null)
  const [items, setItems] = useState([])
  const [ad, setAd] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [isDark, setIsDark] = useState(
    () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  )
  const impressionCounted = useRef(false)

  // Follow the site-wide dark mode (html.dark class) so the page background
  // always matches the text colours — light text never sits on a light bg.
  useEffect(() => {
    const el = document.documentElement
    const update = () => setIsDark(el.classList.contains('dark'))
    update()
    const observer = new MutationObserver(update)
    observer.observe(el, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError('')
      impressionCounted.current = false
      if (!isSupabaseConfigured) {
        setError('Supabase is not connected yet. This page cannot load until the project is connected.')
        setLoading(false)
        return
      }
      const row = await getAccountBySlug(supabase, slug)
      if (!row) {
        setError('This page does not exist.')
        setLoading(false)
        return
      }
      setAccount(row)

      if (row.status === 'active') {
        const table = row.type === 'store' ? 'products' : row.type === 'freelancer' ? 'projects' : 'bio_links'
        const { data: itemRows, error: itemsError } = await supabase
          .from(table)
          .select('*')
          .eq('account_id', row.id)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true })
        if (itemsError) {
          setError('Could not load this page: ' + itemsError.message)
        } else {
          setItems(itemRows || [])
        }

        // Live ad slot for this placement, if a running campaign exists.
        const { data: campaign } = await supabase
          .from('ad_campaigns')
          .select('*')
          .eq('placement', 'storefront')
          .eq('status', 'running')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (campaign) {
          setAd(campaign)
          // Count one impression for this page view.
          if (!impressionCounted.current) {
            impressionCounted.current = true
            await supabase
              .from('ad_campaigns')
              .update({ impressions: (campaign.impressions || 0) + 1 })
              .eq('id', campaign.id)
          }
        }
      }
      setLoading(false)
    }
    load()
  }, [slug])

  async function handleAdClick() {
    if (!ad) return
    await supabase
      .from('ad_campaigns')
      .update({ clicks: (ad.clicks || 0) + 1 })
      .eq('id', ad.id)
    setAd((prev) => (prev ? { ...prev, clicks: (prev.clicks || 0) + 1 } : prev))
  }

  async function copyPageLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <p className="text-muted">Loading page…</p>
      </div>
    )
  }

  if (error || !account) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <div className="rounded-2xl bg-white p-10 shadow-card dark:bg-night-card">
          <h1 className="font-display text-3xl text-ink dark:text-white">Page not found</h1>
          <p className="mt-3 text-muted dark:text-brand-200">{error || 'This page does not exist.'}</p>
          <Link to="/" className="mt-6 inline-block rounded-full bg-brand-600 px-6 py-2.5 font-medium text-white">
            Go to Zyam Web
          </Link>
        </div>
      </div>
    )
  }

  if (UNAVAILABLE.includes(account.status)) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <div className="rounded-2xl bg-white p-10 shadow-card dark:bg-night-card">
          <h1 className="font-display text-3xl text-ink dark:text-white">Temporarily unavailable</h1>
          <p className="mt-3 text-muted dark:text-brand-200">
            {account.business_name ? `${account.business_name} is` : 'This page is'} temporarily unavailable. Please check back later.
          </p>
          <Link to="/" className="mt-6 inline-block rounded-full bg-brand-600 px-6 py-2.5 font-medium text-white">
            Go to Zyam Web
          </Link>
        </div>
      </div>
    )
  }

  const theme = THEMES[account.theme] || THEMES.lavender
  const accent = account.accent || theme.primary
  const pageBg = isDark ? theme.dark : theme.soft
  const wa = whatsappLink(account.whatsapp, `Hi ${account.business_name}! I found your page on Zyam Web.`)
  const socialLinks = Array.isArray(account.social_links) ? account.social_links : []
  const initial = (account.business_name || '•').charAt(0).toUpperCase()
  const mapsUrl = account.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(account.address)}`
    : ''
  const itemCount = items.length

  return (
    <div className="min-h-screen" style={{ backgroundColor: pageBg }}>
      <div className="mx-auto max-w-4xl px-4 py-10 sm:py-14">
        {/* Hero card — logo, name, tagline, actions */}
        <header className="rise rounded-3xl bg-white p-6 text-center shadow-card dark:bg-night-card sm:p-10">
          <div
            className="mx-auto flex h-20 w-20 items-center justify-center rounded-full text-3xl font-bold text-white shadow-pill"
            style={{ background: `linear-gradient(135deg, ${accent}, ${theme.primary})` }}
            aria-hidden="true"
          >
            {initial}
          </div>
          <h1 className="mt-4 font-display text-4xl font-bold leading-tight text-ink dark:text-white sm:text-5xl">
            {account.business_name}
          </h1>
          {account.tagline && <p className="mt-2 text-lg font-medium" style={{ color: accent }}>{account.tagline}</p>}
          {account.description && <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted dark:text-brand-200">{account.description}</p>}

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {wa && (
              <a
                href={wa}
                target="_blank"
                rel="noreferrer"
                className="rounded-full px-6 py-3 font-semibold text-white shadow-pill transition hover:opacity-90"
                style={{ backgroundColor: accent }}
              >
                Chat on WhatsApp
              </a>
            )}
            {account.address && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border bg-white px-5 py-3 text-sm font-semibold text-ink transition hover:opacity-80 dark:bg-night-card dark:text-white"
                style={{ borderColor: accent, color: accent }}
              >
                Visit us — {account.address}
              </a>
            )}
            <button
              onClick={copyPageLink}
              className="rounded-full border border-brand-300 px-5 py-3 text-sm font-semibold text-brand-700 transition hover:bg-brand-50 dark:border-night-border dark:text-brand-300 dark:hover:bg-night-border"
            >
              {copied ? 'Link copied ✓' : 'Share this page'}
            </button>
          </div>

          {socialLinks.length > 0 && (
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2 border-t border-brand-100 pt-5 dark:border-night-border">
              {socialLinks.map((link, i) => (
                <a
                  key={i}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border bg-white px-4 py-2 text-sm font-medium transition hover:opacity-80 dark:bg-night-card dark:text-white"
                  style={{ borderColor: accent, color: accent }}
                >
                  {link.label}
                </a>
              ))}
            </div>
          )}
        </header>

        {/* Ad slot */}
        {ad && (
          <div className="rise mt-6 rounded-2xl border border-brand-200 bg-white p-4 text-center shadow-card dark:border-night-border dark:bg-night-card" style={{ animationDelay: '0.08s' }}>
            <p className="text-xs uppercase tracking-wide text-muted dark:text-brand-200">Sponsored</p>
            <p className="mt-1 font-medium text-ink dark:text-white">{ad.title}</p>
            <button
              onClick={handleAdClick}
              className="mt-2 text-sm font-medium hover:underline"
              style={{ color: accent }}
            >
              Learn more
            </button>
          </div>
        )}

        {/* Store: product catalog */}
        {account.type === 'store' && (
          <section className="rise mt-10" style={{ animationDelay: '0.12s' }}>
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-display text-2xl font-bold text-ink dark:text-white">Products</h2>
              {itemCount > 0 && (
                <span className="text-sm text-muted dark:text-brand-200">{itemCount} {itemCount === 1 ? 'product' : 'products'}</span>
              )}
            </div>
            {items.length === 0 ? (
              <p className="mt-3 text-muted dark:text-brand-200">No products listed yet. Check back soon.</p>
            ) : (
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((product, i) => (
                  <article
                    key={product.id}
                    className="rise overflow-hidden rounded-2xl bg-white shadow-card transition duration-300 hover:-translate-y-1 hover:shadow-pill dark:bg-night-card"
                    style={{ animationDelay: `${0.15 + i * 0.05}s` }}
                  >
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="h-44 w-full object-cover" />
                    ) : (
                      <div
                        className="flex h-36 w-full items-center justify-center text-4xl font-bold text-white"
                        style={{ background: `linear-gradient(135deg, ${accent}, ${theme.primary})` }}
                        aria-hidden="true"
                      >
                        {product.name?.charAt(0)?.toUpperCase() || '•'}
                      </div>
                    )}
                    <div className="p-5">
                      <h3 className="font-display text-lg font-semibold text-ink dark:text-white">{product.name}</h3>
                      {product.description && <p className="mt-1 text-sm text-muted dark:text-brand-200">{product.description}</p>}
                      <p className="mt-2 font-semibold text-ink dark:text-white">{formatPKR(product.price)}</p>
                      {product.video_link && (
                        <a href={product.video_link} target="_blank" rel="noreferrer" className="mt-1 inline-block text-sm font-medium hover:underline" style={{ color: accent }}>
                          Watch video ↗
                        </a>
                      )}
                      {wa && (
                        <a
                          href={whatsappLink(account.whatsapp, `Hi ${account.business_name}! I want to order: ${product.name} (${formatPKR(product.price)})`)}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-4 block rounded-full px-5 py-2.5 text-center text-sm font-semibold text-white transition hover:opacity-90"
                          style={{ backgroundColor: accent }}
                        >
                          Order on WhatsApp
                        </a>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Freelancer: portfolio projects */}
        {account.type === 'freelancer' && (
          <section className="rise mt-10" style={{ animationDelay: '0.12s' }}>
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-display text-2xl font-bold text-ink dark:text-white">Portfolio</h2>
              {itemCount > 0 && (
                <span className="text-sm text-muted dark:text-brand-200">{itemCount} {itemCount === 1 ? 'project' : 'projects'}</span>
              )}
            </div>
            {items.length === 0 ? (
              <p className="mt-3 text-muted dark:text-brand-200">No projects listed yet. Check back soon.</p>
            ) : (
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((project, i) => (
                  <article
                    key={project.id}
                    className="rise overflow-hidden rounded-2xl bg-white shadow-card transition duration-300 hover:-translate-y-1 hover:shadow-pill dark:bg-night-card"
                    style={{ animationDelay: `${0.15 + i * 0.05}s` }}
                  >
                    {project.image_url ? (
                      <img src={project.image_url} alt={project.title} className="h-44 w-full object-cover" />
                    ) : (
                      <div
                        className="flex h-36 w-full items-center justify-center text-4xl font-bold text-white"
                        style={{ background: `linear-gradient(135deg, ${accent}, ${theme.primary})` }}
                        aria-hidden="true"
                      >
                        {project.title?.charAt(0)?.toUpperCase() || '•'}
                      </div>
                    )}
                    <div className="p-5">
                      <h3 className="font-display text-lg font-semibold text-ink dark:text-white">{project.title}</h3>
                      {project.description && <p className="mt-1 text-sm text-muted dark:text-brand-200">{project.description}</p>}
                      {project.link && (
                        <a href={project.link} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-medium hover:underline" style={{ color: accent }}>
                          View project ↗
                        </a>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Influencer: bio links */}
        {account.type === 'influencer' && (
          <section className="rise mt-10" style={{ animationDelay: '0.12s' }}>
            <h2 className="font-display text-2xl font-bold text-ink dark:text-white">Links</h2>
            {items.length === 0 ? (
              <p className="mt-3 text-muted dark:text-brand-200">No links added yet. Check back soon.</p>
            ) : (
              <ul className="mt-5 space-y-3">
                {items.map((link, i) => (
                  <li key={link.id} className="rise" style={{ animationDelay: `${0.15 + i * 0.05}s` }}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-2xl bg-white px-6 py-4 text-center font-semibold text-ink shadow-card transition hover:-translate-y-0.5 hover:shadow-pill dark:bg-night-card dark:text-white"
                      style={{ borderLeft: `4px solid ${accent}` }}
                    >
                      {link.label}
                      {link.platform && link.platform !== link.label && (
                        <span className="ml-2 text-sm font-normal text-muted dark:text-brand-200">({link.platform})</span>
                      )}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* Footer — contact + actions */}
        <footer className="rise mt-12 rounded-3xl bg-white p-6 text-center shadow-card dark:bg-night-card" style={{ animationDelay: '0.2s' }}>
          {account.address && (
            <p className="text-sm text-muted dark:text-brand-200">
              Visit us: {account.address}
              {' · '}
              <a href={mapsUrl} target="_blank" rel="noreferrer" className="font-medium hover:underline" style={{ color: accent }}>
                Get directions ↗
              </a>
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            {wa && (
              <a
                href={wa}
                target="_blank"
                rel="noreferrer"
                className="rounded-full px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                style={{ backgroundColor: accent }}
              >
                WhatsApp us
              </a>
            )}
            <button
              onClick={copyPageLink}
              className="rounded-full border border-brand-300 px-5 py-2.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-50 dark:border-night-border dark:text-brand-300 dark:hover:bg-night-border"
            >
              {copied ? 'Link copied ✓' : 'Share this page'}
            </button>
            <Link
              to="/"
              className="rounded-full border border-brand-300 px-5 py-2.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-50 dark:border-night-border dark:text-brand-300 dark:hover:bg-night-border"
            >
              Create your own free page
            </Link>
          </div>
          {account.plan === 'free' && (
            <p className="mt-5 text-sm text-muted dark:text-brand-200">
              Made with{' '}
              <Link to="/" className="font-medium hover:underline" style={{ color: accent }}>
                Zyam Web
              </Link>
            </p>
          )}
        </footer>
      </div>
    </div>
  )
}
