export const THEMES = {
  lavender:   { name: 'Lavender',   swatch: ['#F5F0FF', '#7C3AED'], primary: '#7C3AED', soft: '#EDE9FE' },
  emerald:    { name: 'Emerald',    swatch: ['#ECFDF5', '#059669'], primary: '#059669', soft: '#D1FAE5' },
  terracotta: { name: 'Terracotta', swatch: ['#FFF7ED', '#C2410C'], primary: '#C2410C', soft: '#FFEDD5' },
  ocean:      { name: 'Ocean',      swatch: ['#EFF6FF', '#2563EB'], primary: '#2563EB', soft: '#DBEAFE' },
  rose:       { name: 'Rose',       swatch: ['#FFF1F2', '#E11D48'], primary: '#E11D48', soft: '#FFE4E6' }
}

export const PLANS = {
  free: { name: 'Free', price: 0 },
  paid: { name: 'Paid', price: 1999, offer: 1199 }
}

/** How clients pay for the Paid plan: JazzCash, manual verification. */
export const PAYMENT = {
  method: 'JazzCash',
  accountName: 'Wajid Ali',
  accountNumber: '03240636368',
  amount: 1199
}

export const FREEZE_DAYS = 45

/** Whole days between the given date string and now. Returns 0 for missing/invalid dates. */
export function daysSince(dateStr) {
  if (!dateStr) return 0
  const then = new Date(dateStr).getTime()
  if (Number.isNaN(then)) return 0
  const diffMs = Date.now() - then
  if (diffMs <= 0) return 0
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

export function timeAgo(dateStr) {
  if (!dateStr) return '—'
  const s = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

/** Format a number as Pakistani rupees, e.g. formatPKR(1199) -> "Rs 1,199". */
export function formatPKR(n) {
  const num = Number(n) || 0
  return 'Rs ' + num.toLocaleString('en-PK')
}

/** Load a single accounts row by its public slug. Returns the row or null. */
export async function getAccountBySlug(supabase, slug) {
  if (!supabase || !slug) return null
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()
  if (error) {
    console.error('getAccountBySlug failed:', error.message)
    return null
  }
  return data || null
}

/**
 * Build a wa.me link for a WhatsApp number, or null when no usable number is given.
 * Accepts numbers with spaces, dashes, a leading + or a leading 0 (Pakistan numbers
 * starting with 0 are converted to the +92 international form).
 */
export function whatsappLink(number, text) {
  if (!number) return null
  let digits = String(number).replace(/[^0-9]/g, '')
  if (!digits) return null
  if (digits.startsWith('0')) digits = '92' + digits.slice(1)
  const base = 'https://wa.me/' + digits
  if (text) return base + '?text=' + encodeURIComponent(text)
  return base
}
