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
  const impressionCounted = useRef(false)

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
  const wa = whatsappLink(account.whatsapp, `Hi ${account.business_name}! I found your page on Zyam Web.`)
  const socialLinks = Array.isArray(account.social_links) ? account.social_links : []

  return (
    <div className="min-h-screen" style={{ backgroundColor: theme.soft }}>
      <div className="mx-auto max-w-3xl px-4 py-12">
        {/* Header */}
        <header className="text-center">
          <h1 className="font-display text-4xl text-ink dark:text-white">{account.business_name}</h1>
          {account.tagline && <p className="mt-2 text-lg text-muted dark:text-brand-200">{account.tagline}</p>}
          {account.description && <p className="mx-auto mt-3 max-w-xl text-sm text-muted dark:text-brand-200">{account.description}</p>}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            {wa && (
              <a
                href={wa}
                target="_blank"
                rel="noreferrer"
                className="rounded-full px-6 py-3 font-medium text-white shadow-pill"
                style={{ backgroundColor: accent }}
              >
                Chat on WhatsApp
              </a>
            )}
            {socialLinks.map((link, i) => (
              <a
                key={i}
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border bg-white px-5 py-2.5 text-sm font-medium text-ink hover:opacity-80 dark:bg-night-card dark:text-white"
                style={{ borderColor: accent, color: accent }}
              >
                {link.label}
              </a>
            ))}
          </div>
        </header>

        {/* Ad slot */}
        {ad && (
          <div className="mt-8 rounded-2xl border border-brand-200 bg-white p-4 text-center shadow-card dark:border-night-border dark:bg-night-card">
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
          <section className="mt-10">
            <h2 className="font-display text-2xl text-ink dark:text-white">Products</h2>
            {items.length === 0 ? (
              <p className="mt-3 text-muted dark:text-brand-200">No products listed yet. Check back soon.</p>
            ) : (
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {items.map((product) => (
                  <article key={product.id} className="overflow-hidden rounded-2xl bg-white shadow-card dark:bg-night-card">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="h-44 w-full object-cover" />
                    ) : (
                      <div className="flex h-24 w-full items-center justify-center text-3xl font-display" style={{ backgroundColor: theme.soft, color: accent }}>
                        {product.name?.charAt(0)?.toUpperCase() || '•'}
                      </div>
                    )}
                    <div className="p-5">
                      <h3 className="font-display text-lg text-ink dark:text-white">{product.name}</h3>
                      {product.description && <p className="mt-1 text-sm text-muted dark:text-brand-200">{product.description}</p>}
                      <p className="mt-2 font-medium text-ink dark:text-white">{formatPKR(product.price)}</p>
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
                          className="mt-4 block rounded-full px-5 py-2.5 text-center text-sm font-medium text-white"
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
          <section className="mt-10">
            <h2 className="font-display text-2xl text-ink dark:text-white">Portfolio</h2>
            {items.length === 0 ? (
              <p className="mt-3 text-muted dark:text-brand-200">No projects listed yet. Check back soon.</p>
            ) : (
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {items.map((project) => (
                  <article key={project.id} className="overflow-hidden rounded-2xl bg-white shadow-card dark:bg-night-card">
                    {project.image_url ? (
                      <img src={project.image_url} alt={project.title} className="h-44 w-full object-cover" />
                    ) : (
                      <div className="flex h-24 w-full items-center justify-center text-3xl font-display" style={{ backgroundColor: theme.soft, color: accent }}>
                        {project.title?.charAt(0)?.toUpperCase() || '•'}
                      </div>
                    )}
                    <div className="p-5">
                      <h3 className="font-display text-lg text-ink dark:text-white">{project.title}</h3>
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
          <section className="mt-10">
            <h2 className="font-display text-2xl text-ink dark:text-white">Links</h2>
            {items.length === 0 ? (
              <p className="mt-3 text-muted dark:text-brand-200">No links added yet. Check back soon.</p>
            ) : (
              <ul className="mt-5 space-y-3">
                {items.map((link) => (
                  <li key={link.id}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-2xl bg-white px-6 py-4 text-center font-medium text-ink shadow-card transition hover:opacity-90 dark:bg-night-card dark:text-white"
                      style={{ borderLeft: `4px solid ${accent}` }}
                    >
                      {link.label}
                      {link.platform && link.platform !== link.label && (
                        <span className="ml-2 text-sm text-muted dark:text-brand-200">({link.platform})</span>
                      )}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* Footer — free plan only */}
        {account.plan === 'free' && (
          <footer className="mt-12 text-center text-sm text-muted dark:text-brand-200">
            Made with{' '}
            <Link to="/" className="font-medium hover:underline" style={{ color: accent }}>
              Zyam Web
            </Link>
          </footer>
        )}
      </div>
    </div>
  )
}
