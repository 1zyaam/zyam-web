import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * Zyam Web logo.
 * Lavender gradient rounded-square tile with a deep-violet "Z",
 * plus a "ZYAM WEB" wordmark in Fraunces (distinctive serif).
 * No gold anywhere.
 *
 * Single click/tap goes home. Three taps within ~900ms calls onTripleTap
 * (the parent wires that to /admin). The single-click navigation is
 * delayed briefly so a triple-tap is not also treated as a home click.
 */
export default function Logo({ onTripleTap }) {
  const navigate = useNavigate()
  const tapsRef = useRef([])
  const navTimerRef = useRef(null)

  function handleClick() {
    const now = Date.now()
    tapsRef.current = [...tapsRef.current, now].filter((t) => now - t <= 1500)

    if (tapsRef.current.length >= 3) {
      tapsRef.current = []
      if (navTimerRef.current) {
        clearTimeout(navTimerRef.current)
        navTimerRef.current = null
      }
      if (onTripleTap) onTripleTap()
      return
    }

    if (navTimerRef.current) clearTimeout(navTimerRef.current)
    navTimerRef.current = setTimeout(() => {
      navTimerRef.current = null
      navigate('/')
    }, 280)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Zyam Web — home"
      className="flex shrink-0 items-center gap-2 rounded-xl focus-visible:outline-none"
    >
      <img
        src="/logo-mark.png"
        alt="Zyam Web logo"
        className="logo-mark h-9 w-9 shrink-0 rounded-[8px] object-cover ring-1 ring-black/10 dark:ring-white/10"
      />
      <span className="logo-word font-display text-lg font-semibold tracking-wide text-ink dark:text-white">
        ZYAM&nbsp;WEB
      </span>
    </button>
  )
}
