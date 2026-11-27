/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Light-purple brand palette (NO gold anywhere)
        brand: {
          50: '#F5F0FF',
          100: '#EDE9FE',
          200: '#DDD6FE',
          300: '#C4B5FD',
          400: '#A78BFA',
          500: '#8B5CF6',
          600: '#7C3AED',
          700: '#6D28D9',
          800: '#5B21B6',
          900: '#4C1D95'
        },
        // Vessa-style dashboard palette (copper accent, warm greige / near-black)
        vessa: {
          bg: '#E7E5DF',
          card: '#FCFDFC',
          copper: '#A8481C',
          copperDark: '#8F3A17',
          peach: '#FFA77A',
          peachLight: '#FFB98F',
          teal: '#5399AE',
          tealLight: '#80CADE',
          amber: '#DAB167',
          amberLight: '#F6D590',
          darkBg: '#141513',
          darkCard: '#171D1A'
        },
        ink: '#1E1B2E',
        muted: '#6B6580',
        night: {
          bg1: '#1E1533',
          bg2: '#2A1D4D',
          card: '#2E2350',
          border: '#3B2D63'
        }
      },
      fontFamily: {
        sans: ['"Instrument Sans"', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'serif'],
        josefin: ['"Josefin Sans"', 'sans-serif']
      },
      boxShadow: {
        pill: '0 10px 30px rgba(124, 58, 237, 0.12)',
        card: '0 6px 24px rgba(30, 21, 51, 0.08)'
      }
    }
  },
  plugins: []
}
