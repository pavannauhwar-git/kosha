/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // ── App backgrounds — Stripe-inspired deep navy ───────────────
        'kosha-bg':            '#0a2540',
        'kosha-bg-2':          '#0d2d4d',
        'kosha-surface':       'rgba(255,255,255,0.06)',
        'kosha-surface-2':     'rgba(255,255,255,0.03)',
        'kosha-border':        'rgba(255,255,255,0.10)',
        'kosha-border-strong': 'rgba(255,255,255,0.20)',

        // ── Brand — Stripe Indigo + Cyan ────────────────────────────
        'brand':           '#635bff',
        'brand-dark':      '#4b45c6',
        'brand-mid':       '#7a73ff',
        'brand-bg':        'rgba(99,91,255,0.12)',
        'brand-container': 'rgba(99,91,255,0.15)',
        'brand-on':        '#a5b4fc',
        'brand-accent':    '#80e9ff',

        // ── Income ────────────────────────────────────────────────────
        'income':        '#00d4aa',
        'income-bg':     'rgba(0,212,170,0.12)',
        'income-text':   '#00d4aa',
        'income-border': 'rgba(0,212,170,0.25)',

        // ── Expense ───────────────────────────────────────────────────
        'expense':        '#ff5c83',
        'expense-bg':     'rgba(255,92,131,0.12)',
        'expense-text':   '#ff5c83',
        'expense-border': 'rgba(255,92,131,0.25)',

        // ── Investment ────────────────────────────────────────────────
        'invest':        '#a960ee',
        'invest-bg':     'rgba(169,96,238,0.12)',
        'invest-text':   '#c084fc',
        'invest-border': 'rgba(169,96,238,0.25)',

        // ── Repayment / Bills ─────────────────────────────────────────
        'repay':        '#f7b32b',
        'repay-bg':     'rgba(247,179,43,0.12)',
        'repay-text':   '#f7b32b',
        'repay-border': 'rgba(247,179,43,0.25)',

        // ── Warning ───────────────────────────────────────────────────
        'warning':        '#f7b32b',
        'warning-bg':     'rgba(247,179,43,0.12)',
        'warning-border': 'rgba(247,179,43,0.25)',
        'warning-text':   '#f7b32b',

        // ── Ink — light on dark ───────────────────────────────────────
        'ink':   '#f6f9fc',
        'ink-2': '#c1c9d2',
        'ink-3': '#8898aa',
        'ink-4': '#5e6e82',

        // ── Utility ───────────────────────────────────────────────────
        'on-grad':   '#FFFFFF',
        'on-grad-2': 'rgba(255,255,255,0.75)',
        'success':   '#00d4aa',
        'danger':    '#ff5c83',
      },

      fontFamily: {
        display: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        sans:    ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },

      fontSize: {
        'caption': ['12px', { lineHeight: '1.5',  letterSpacing: '0.02em'  }],
        'label':   ['14px', { lineHeight: '1.5',  letterSpacing: '0em'     }],
        'body':    ['16px', { lineHeight: '1.6',  letterSpacing: '-0.01em' }],
        'value':   ['20px', { lineHeight: '1.3',  letterSpacing: '-0.02em' }],
        'display': ['28px', { lineHeight: '1.15', letterSpacing: '-0.03em' }],
        'hero':    ['40px', { lineHeight: '1.0',  letterSpacing: '-0.03em' }],
      },

      borderRadius: {
        'card':    '16px',
        'card-lg': '20px',
        'hero':    '24px',
        'chip':    '8px',
        'pill':    '9999px',
      },

      boxShadow: {
        'card':       '0 2px 8px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.06)',
        'card-md':    '0 4px 16px rgba(0,0,0,0.30), 0 0 0 1px rgba(255,255,255,0.06)',
        'card-lg':    '0 8px 32px rgba(0,0,0,0.36), 0 0 0 1px rgba(255,255,255,0.06)',
        'apple-card': '0 24px 64px rgba(0,0,0,0.40), 0 0 0 1px rgba(255,255,255,0.08)',
        'fab':        '0 4px 16px rgba(99,91,255,0.50), 0 0 0 1px rgba(99,91,255,0.60)',
        'focus':      '0 0 0 3px rgba(99,91,255,0.40)',
        'urgent':     '0 2px 12px rgba(255,92,131,0.30), 0 0 0 1px rgba(255,92,131,0.20)',
        'warn':       '0 2px 12px rgba(247,179,43,0.30), 0 0 0 1px rgba(247,179,43,0.20)',
        'glow':       '0 0 60px rgba(128,233,255,0.15), 0 0 120px rgba(99,91,255,0.10)',
      },

      keyframes: {
        'sheet-in': {
          '0%':   { transform: 'translateY(100%)' },
          '72%':  { transform: 'translateY(-4px)'  },
          '100%': { transform: 'translateY(0)'     },
        },
        'fade-in':  { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'slide-up': {
          '0%':   { transform: 'translateY(12px)', opacity: '0' },
          '100%': { transform: 'translateY(0)',    opacity: '1' },
        },
        'swipe-out': {
          '0%':   { transform: 'translateX(0)',     opacity: '1' },
          '100%': { transform: 'translateX(-100%)', opacity: '0' },
        },
        'scale-in': {
          '0%':   { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)',    opacity: '1' },
        },
        'mesh-shift': {
          '0%':   { backgroundPosition: '0% 50%' },
          '50%':  { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
      },
      animation: {
        'sheet-in':   'sheet-in 0.30s cubic-bezier(0.32,0.72,0,1) forwards',
        'fade-in':    'fade-in 0.2s ease forwards',
        'slide-up':   'slide-up 0.22s ease forwards',
        'swipe-out':  'swipe-out 0.22s ease forwards',
        'scale-in':   'scale-in 0.18s ease forwards',
        'mesh-shift': 'mesh-shift 12s ease infinite',
      },
    },
  },
  plugins: [],
}
