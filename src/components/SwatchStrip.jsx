import { THEMES } from '../lib/store'

/**
 * Compact theme swatch strip.
 * One small round two-tone swatch per theme, with the theme name underneath.
 * Clicking a swatch calls onChange(themeKey) immediately.
 */
export default function SwatchStrip({ value, onChange }) {
  const entries = Object.entries(THEMES || {})

  if (entries.length === 0) return null

  return (
    <div className="flex flex-wrap items-start justify-center gap-4" role="group" aria-label="Choose a theme">
      {entries.map(([key, theme]) => {
        const selected = value === key
        const [light, dark] = theme.swatch || [theme.soft || '#F5F0FF', theme.primary || '#7C3AED']
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange && onChange(key)}
            aria-pressed={selected}
            aria-label={`Theme: ${theme.name}`}
            title={theme.name}
            className="flex w-14 flex-col items-center gap-1.5 rounded-lg focus-visible:outline-none"
          >
            <span
              aria-hidden="true"
              className={`block h-9 w-9 rounded-full transition-transform hover:scale-110 ${
                selected ? 'ring-2 ring-ink ring-offset-2 dark:ring-white dark:ring-offset-night-bg1' : 'ring-1 ring-black/10 dark:ring-white/20'
              }`}
              style={{ background: `linear-gradient(135deg, ${light} 50%, ${dark} 50%)` }}
            />
            <span
              className={`text-xs leading-none ${
                selected ? 'font-semibold text-ink dark:text-white' : 'text-muted dark:text-white/70'
              }`}
            >
              {theme.name}
            </span>
          </button>
        )
      })}
    </div>
  )
}
