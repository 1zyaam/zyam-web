import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { THEMES, PLANS, FREEZE_DAYS, formatPKR } from '../lib/store'
import SwatchStrip from '../components/SwatchStrip.jsx'

/* Hero words: SHOP / PORTFOLIO / SOCIAL LINKS render bold in violet. */
const HERO_WORDS = [
  { text: 'A', bold: false },
  { text: 'PROFESSIONAL', bold: false },
  { text: 'PAGE', bold: false },
  { text: 'FOR', bold: false },
  { text: 'YOUR', bold: false },
  { text: 'SHOP,', bold: true },
  { text: 'PORTFOLIO', bold: true },
  { text: '&', bold: false },
  { text: 'SOCIAL', bold: true },
  { text: 'LINKS', bold: true },
]

const FEATURES = [
  {
    title: 'Shop catalog',
    text: 'List your products with prices, photos and descriptions — a clean store page your customers can browse in seconds.',
  },
  {
    title: 'Portfolio',
    text: 'Show your best work as projects with images and links, so new clients see what you can do before they message you.',
  },
  {
    title: 'Social links',
    text: 'Put every profile in one place — Instagram, TikTok, YouTube, Facebook and more — on a single page you can share anywhere.',
  },
  {
    title: 'WhatsApp button',
    text: 'Visitors tap once and land straight in your WhatsApp chat, ready to order or ask a question.',
  },
  {
    title: 'Your own theme',
    text: 'Pick a colour theme that matches your brand. Your page recolors instantly — no design skills needed.',
  },
  {
    title: 'Share one link',
    text: 'One short link for your bio, your business card and your status. Every visitor sees the same professional page.',
  },
]

export default function Landing() {
  const location = useLocation()
  const [themeKey, setThemeKey] = useState('lavender')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [formStatus, setFormStatus] = useState('idle') // idle | sending | sent | error
  const [formError, setFormError] = useState('')

  const theme = (THEMES && THEMES[themeKey]) || (THEMES && THEMES.lavender) || {
    name: 'Lavender',
    primary: '#7C3AED',
    soft: '#EDE9FE',
  }

  /* Scroll to a #features / #pricing anchor when arriving via a TopBar link. */
  useEffect(() => {
    if (location.hash) {
      const el = document.querySelector(location.hash)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [location.hash])

  async function handleSupportSubmit(event) {
    event.preventDefault()
    setFormError('')

    if (!isSupabaseConfigured) {
      setFormStatus('error')
      setFormError('Connect Supabase to enable this form — your message was not sent.')
      return
    }
    if (!name.trim() || !email.trim() || !message.trim()) {
      setFormStatus('error')
      setFormError('Please fill in your name, email and message.')
      return
    }

    setFormStatus('sending')
    const { error } = await supabase.from('support_messages').insert({
      name: name.trim(),
      email: email.trim(),
      message: message.trim(),
      status: 'open',
    })

    if (error) {
      setFormStatus('error')
      setFormError(`Could not send your message: ${error.message}`)
      return
    }

    setFormStatus('sent')
    setName('')
    setEmail('')
    setMessage('')
  }

  return (
    <main className="pb-24 md:pb-0">
      {/* ---------- Hero ---------- */}
      <section className="mx-auto max-w-5xl px-4 pt-14 text-center sm:pt-20">
        <h1
          aria-label="A professional page for your shop, portfolio & social links"
          className="font-josefin text-[34px] font-light uppercase leading-[1.15] tracking-wide text-ink dark:text-white sm:text-5xl md:text-6xl"
        >
          {HERO_WORDS.map((word, i) => (
            <span
              key={`${word.text}-${i}`}
              className={`hero-word ${word.bold ? 'font-bold text-brand-600 dark:text-brand-400' : ''}`}
              style={{ animationDelay: `${i * 70}ms` }}
            >
              {word.text}
              {'\u00A0'}
            </span>
          ))}
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted dark:text-white/70 sm:text-lg">
          Build a beautiful page for your business in minutes — your products, your work and
          all your social links in one place. No coding, no designer, no cost to start.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/signup"
            className="w-full rounded-full bg-brand-600 px-7 py-3 text-base font-semibold text-white shadow-pill transition-colors hover:bg-brand-700 sm:w-auto"
          >
            Create your page — it&apos;s free
          </Link>
          <a
            href="#pricing"
            className="w-full rounded-full bg-white px-7 py-3 text-base font-semibold text-brand-700 ring-1 ring-brand-200 transition-colors hover:bg-brand-100 dark:bg-night-card dark:text-white dark:ring-night-border dark:hover:bg-night-border sm:w-auto"
          >
            See pricing
          </a>
        </div>

        {/* ---------- Live theme preview ---------- */}
        <div className="mx-auto mt-14 max-w-2xl">
          <p className="mb-4 text-sm font-medium text-muted dark:text-white/70">
            Pick a theme — watch the preview change instantly
          </p>
          <SwatchStrip value={themeKey} onChange={setThemeKey} />

          <div
            className="mt-6 rounded-3xl p-6 text-left shadow-card ring-1 ring-black/5 transition-colors dark:ring-white/10 sm:p-8"
            style={{ backgroundColor: theme.soft }}
          >
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: theme.primary }}>
              Live preview · {theme.name}
            </p>
            <h2 className="mt-2 font-display text-2xl font-semibold text-ink sm:text-3xl">
              My Shop
            </h2>
            <p className="mt-1 text-sm text-ink/70">
              Handmade soaps, fresh scents and honest prices — order straight from this page.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {['Lavender Soap', 'Rose Candle', 'Gift Box'].map((item, i) => (
                <div key={item} className="rounded-2xl bg-white/80 p-3 ring-1 ring-black/5 dark:bg-night-card/80">
                  <div
                    className="h-16 rounded-xl"
                    style={{ backgroundColor: i === 1 ? theme.primary : theme.soft, opacity: i === 1 ? 0.85 : 1 }}
                  />
                  <p className="mt-2 text-sm font-semibold text-ink dark:text-white">{item}</p>
                  <p className="text-xs text-muted dark:text-white/60">Rs {250 + i * 150}</p>
                </div>
              ))}
            </div>
            <span
              aria-hidden="true"
              className="mt-6 inline-block rounded-full px-5 py-2.5 text-sm font-semibold text-white"
              style={{ backgroundColor: theme.primary }}
            >
              Chat on WhatsApp
            </span>
          </div>
        </div>
      </section>

      {/* ---------- Features ---------- */}
      <section id="features" className="mx-auto max-w-5xl scroll-mt-28 px-4 pt-20">
        <h2 className="text-center font-display text-3xl font-semibold text-ink dark:text-white sm:text-4xl">
          Everything you need on one page
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-muted dark:text-white/70">
          Whether you run a shop, freelance full-time or grow an audience — your page
          is ready to share the moment you create it.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <article
              key={feature.title}
              className="rounded-3xl bg-white p-6 shadow-card ring-1 ring-black/5 transition-transform hover:-translate-y-1 dark:bg-night-card dark:ring-white/10"
            >
              <h3 className="font-display text-xl font-semibold text-ink dark:text-white">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted dark:text-white/70">{feature.text}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ---------- Pricing ---------- */}
      <section id="pricing" className="mx-auto max-w-5xl scroll-mt-28 px-4 pt-20">
        <h2 className="text-center font-display text-3xl font-semibold text-ink dark:text-white sm:text-4xl">
          Simple pricing
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-muted dark:text-white/70">
          Start free. Upgrade when you want your page to stay live forever, with no branding.
        </p>

        <div className="mx-auto mt-10 grid max-w-3xl gap-4 md:grid-cols-2">
          {/* Free */}
          <article className="rounded-3xl bg-white p-7 shadow-card ring-1 ring-black/5 dark:bg-night-card dark:ring-white/10">
            <h3 className="font-display text-2xl font-semibold text-ink dark:text-white">
              {PLANS?.free?.name || 'Free'}
            </h3>
            <p className="mt-2 text-4xl font-bold text-ink dark:text-white">
              {formatPKR ? formatPKR(0) : 'Rs 0'}
              <span className="ml-1 text-base font-normal text-muted dark:text-white/60">/ forever</span>
            </p>
            <ul className="mt-6 space-y-3 text-sm text-ink/80 dark:text-white/80">
              <li>✓ Your shop, portfolio or social links page</li>
              <li>✓ All colour themes</li>
              <li>✓ WhatsApp button and social links</li>
              <li>✓ &ldquo;Made with Zyam Web&rdquo; footer shown on your page</li>
              <li>✓ Free plan freezes after {FREEZE_DAYS || 45} days of inactivity — just log in again to unfreeze it</li>
            </ul>
            <Link
              to="/signup"
              className="mt-8 block rounded-full bg-brand-100 px-6 py-3 text-center text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-200 dark:bg-night-border dark:text-white"
            >
              Start free
            </Link>
          </article>

          {/* Paid */}
          <article className="relative rounded-3xl bg-brand-600 p-7 text-white shadow-pill ring-1 ring-brand-600">
            <span className="absolute -top-3 right-6 rounded-full bg-white px-3 py-1 text-xs font-bold text-brand-700">
              OFFER
            </span>
            <h3 className="font-display text-2xl font-semibold">{PLANS?.paid?.name || 'Paid'}</h3>
            <p className="mt-2">
              <span className="text-xl text-white/70 line-through">
                {formatPKR ? formatPKR(PLANS?.paid?.price || 1999) : 'Rs 1,999'}
              </span>{' '}
              <span className="text-4xl font-bold">
                {formatPKR ? formatPKR(PLANS?.paid?.offer || 1199) : 'Rs 1,199'}
              </span>
              <span className="ml-1 text-base font-normal text-white/70">/ year</span>
            </p>
            <ul className="mt-6 space-y-3 text-sm text-white/90">
              <li>✓ Everything in Free</li>
              <li>✓ &ldquo;Made with Zyam Web&rdquo; footer removed from your page</li>
              <li>✓ Never freezes — your page stays live no matter how long you are away</li>
              <li>✓ Priority support</li>
            </ul>
            <Link
              to="/signup"
              className="mt-8 block rounded-full bg-white px-6 py-3 text-center text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-100"
            >
              Get Paid — {formatPKR ? formatPKR(PLANS?.paid?.offer || 1199) : 'Rs 1,199'}/year
            </Link>
          </article>
        </div>
      </section>

      {/* ---------- Final CTA ---------- */}
      <section className="mx-auto max-w-5xl px-4 pt-20 text-center">
        <h2 className="font-display text-3xl font-semibold text-ink dark:text-white sm:text-4xl">
          Your page is waiting.
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-muted dark:text-white/70">
          Pick your type, add your details, choose a theme — and share your link today.
        </p>
        <Link
          to="/signup"
          className="mt-7 inline-block rounded-full bg-brand-600 px-8 py-3.5 text-base font-semibold text-white shadow-pill transition-colors hover:bg-brand-700"
        >
          Create your free page
        </Link>
      </section>

      {/* ---------- Footer + support form ---------- */}
      <footer className="mx-auto mt-20 max-w-5xl px-4 pb-10">
        <div className="rounded-3xl bg-white p-7 shadow-card ring-1 ring-black/5 dark:bg-night-card dark:ring-white/10 sm:p-9">
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <p className="font-display text-xl font-semibold text-ink dark:text-white">Zyam Web</p>
              <p className="mt-2 text-sm leading-relaxed text-muted dark:text-white/70">
                A professional page for your shop, portfolio and social links.
                Made for small businesses, freelancers and creators.
              </p>
              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium">
                <Link to="/" className="text-brand-700 hover:underline dark:text-brand-300">Home</Link>
                <a href="#features" className="text-brand-700 hover:underline dark:text-brand-300">Features</a>
                <a href="#pricing" className="text-brand-700 hover:underline dark:text-brand-300">Pricing</a>
                <Link to="/signup" className="text-brand-700 hover:underline dark:text-brand-300">Sign up</Link>
                <Link to="/login" className="text-brand-700 hover:underline dark:text-brand-300">Log in</Link>
              </div>
            </div>

            <div>
              <h3 className="font-display text-lg font-semibold text-ink dark:text-white">Contact support</h3>
              <p className="mt-1 text-sm text-muted dark:text-white/70">
                Questions, or want to upgrade to the Paid plan? Send us a message.
              </p>

              {!isSupabaseConfigured && (
                <p className="mt-4 rounded-xl bg-brand-100 px-4 py-3 text-sm font-medium text-brand-800 dark:bg-night-border dark:text-white">
                  Connect Supabase to enable this form — messages are saved to support_messages.
                </p>
              )}

              {formStatus === 'sent' ? (
                <p role="status" className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800">
                  Thank you — your message has been sent. We will get back to you by email.
                </p>
              ) : (
                <form onSubmit={handleSupportSubmit} className="mt-4 space-y-3">
                  <div>
                    <label htmlFor="support-name" className="mb-1 block text-sm font-medium text-ink dark:text-white">Name</label>
                    <input
                      id="support-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      placeholder="Your name"
                      className="w-full rounded-xl border border-brand-200 bg-white px-3 py-2.5 text-sm text-ink placeholder:text-muted/70 focus:border-brand-600 focus:outline-none dark:border-night-border dark:bg-night-bg1 dark:text-white"
                    />
                  </div>
                  <div>
                    <label htmlFor="support-email" className="mb-1 block text-sm font-medium text-ink dark:text-white">Email</label>
                    <input
                      id="support-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="you@example.com"
                      className="w-full rounded-xl border border-brand-200 bg-white px-3 py-2.5 text-sm text-ink placeholder:text-muted/70 focus:border-brand-600 focus:outline-none dark:border-night-border dark:bg-night-bg1 dark:text-white"
                    />
                  </div>
                  <div>
                    <label htmlFor="support-message" className="mb-1 block text-sm font-medium text-ink dark:text-white">Message</label>
                    <textarea
                      id="support-message"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      required
                      rows={4}
                      placeholder="How can we help?"
                      className="w-full resize-y rounded-xl border border-brand-200 bg-white px-3 py-2.5 text-sm text-ink placeholder:text-muted/70 focus:border-brand-600 focus:outline-none dark:border-night-border dark:bg-night-bg1 dark:text-white"
                    />
                  </div>
                  {formStatus === 'error' && formError && (
                    <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 ring-1 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-800">
                      {formError}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={formStatus === 'sending'}
                    className="rounded-full bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
                  >
                    {formStatus === 'sending' ? 'Sending…' : 'Send message'}
                  </button>
                </form>
              )}
            </div>
          </div>

          <p className="mt-8 border-t border-brand-100 pt-5 text-center text-xs text-muted dark:border-night-border dark:text-white/50">
            © 2026 Zyam Web. All rights reserved.
          </p>
        </div>
      </footer>
    </main>
  )
}
