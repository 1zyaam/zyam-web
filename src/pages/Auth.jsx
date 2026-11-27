import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { FREEZE_DAYS, daysSince } from '../lib/store'

export default function Auth() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)

  // Already signed in? Go straight to the dashboard.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) navigate('/dashboard', { replace: true })
    })
  }, [navigate])

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setNotice('')
    if (!isSupabaseConfigured) {
      setError('Supabase is not connected yet. Connect Supabase to enable login.')
      return
    }
    if (!email.trim() || !password) {
      setError('Enter your email and password.')
      return
    }
    setLoading(true)
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      })
      if (signInError) {
        setError('Wrong email or password. Please try again.')
        return
      }
      const user = data?.user
      if (!user) {
        setError('Login did not return a user. Please try again.')
        return
      }

      // Load the user's account row.
      const { data: account, error: accountError } = await supabase
        .from('accounts')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()
      if (accountError) {
        setError('Could not load your account: ' + accountError.message)
        return
      }
      if (!account) {
        setError('No Zyam Web account is linked to this login yet. Please finish signing up first.')
        return
      }

      // Freeze rule: a free account frozen after 45+ days of inactivity is
      // unfrozen by re-logging in.
      const inactiveDays = daysSince(account.last_active_at)
      if (
        account.plan === 'free' &&
        account.status === 'frozen' &&
        inactiveDays >= FREEZE_DAYS
      ) {
        const { error: unfreezeError } = await supabase
          .from('accounts')
          .update({ status: 'active', last_active_at: new Date().toISOString() })
          .eq('id', account.id)
        if (unfreezeError) {
          setError('Your account was frozen for inactivity and could not be reactivated: ' + unfreezeError.message)
          return
        }
        setNotice('Welcome back! Your account was frozen for inactivity and has now been reactivated.')
      } else {
        // Any successful login counts as activity.
        await supabase
          .from('accounts')
          .update({ last_active_at: new Date().toISOString() })
          .eq('id', account.id)
      }

      navigate('/dashboard', { replace: true })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-2xl bg-white p-8 shadow-card dark:bg-night-card">
        <h1 className="font-display text-3xl text-ink dark:text-white">Log in</h1>
        <p className="mt-2 text-sm text-muted dark:text-brand-200">
          Sign in to manage your Zyam Web store, portfolio or links.
        </p>

        {!isSupabaseConfigured && (
          <p className="mt-4 rounded-xl bg-brand-100 px-4 py-3 text-sm text-brand-800 dark:bg-night-border dark:text-brand-200">
            Connect Supabase to enable this. Login is unavailable until the project is connected.
          </p>
        )}

        {error && (
          <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-200">
            {error}
          </p>
        )}
        {notice && (
          <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200">
            {notice}
          </p>
        )}

        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <div>
            <label htmlFor="login-email" className="block text-sm font-medium text-ink dark:text-white">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-1 w-full rounded-xl border border-brand-200 bg-white px-4 py-2.5 text-ink outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-300 dark:border-night-border dark:bg-night-bg1 dark:text-white"
            />
          </div>
          <div>
            <label htmlFor="login-password" className="block text-sm font-medium text-ink dark:text-white">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              className="mt-1 w-full rounded-xl border border-brand-200 bg-white px-4 py-2.5 text-ink outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-300 dark:border-night-border dark:bg-night-bg1 dark:text-white"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !isSupabaseConfigured}
            className="w-full rounded-full bg-brand-600 px-6 py-3 font-medium text-white shadow-pill transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Log in'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted dark:text-brand-200">
          Don&apos;t have an account yet?{' '}
          <Link to="/signup" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
            Create one
          </Link>
        </p>
      </div>
    </div>
  )
}
