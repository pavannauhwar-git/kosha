/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // ── App backgrounds ───────────────────────────────────────────────
        'kosha-bg':            '#FEFEFF',
        'kosha-bg-2':          '#F9FAFF',
        'kosha-surface':       '#FFFFFF',
        'kosha-surface-2':     '#F6F8FF',
        'kosha-border':        '#C7D4FF',
        'kosha-border-strong': '#6D87E8',

        // ── Brand — Royal Indigo + Warm Amber ────────────────────────────
        'brand':           '#1E3A8A',
        'brand-dark':      '#162B66',
        'brand-mid':       '#3659C7',
        'brand-bg':        '#F1F4FF',
        'brand-container': '#E9EEFF',
        'brand-on':        '#1A2E73',
        'brand-accent':    '#FFE1B8',

        // ── Income ────────────────────────────────────────────────────────
        'income':        '#0E9F6E',
        'income-bg':     '#EAFBF4',
        'income-text':   '#0B7F5A',
        'income-border': '#A7F3D0',

        // ── Expense ───────────────────────────────────────────────────────
        'expense':        '#E11D48',
        'expense-bg':     '#FFF1F2',
        'expense-text':   '#BE123C',
        'expense-border': '#FECDD3',

        // ── Investment ────────────────────────────────────────────────────
        'invest':        '#7C3AED',
        'invest-bg':     '#F3EEFF',
        'invest-text':   '#5B21B6',
        'invest-border': '#DDD0FF',

        // ── Repayment / Bills ─────────────────────────────────────────────
        'repay':        '#B4691F',
        'repay-bg':     '#FFF8EE',
        'repay-text':   '#96571A',
        'repay-border': '#F6D8AD',

        // ── Warning ───────────────────────────────────────────────────────
        'warning':        '#D97706',
        'warning-bg':     '#FFF8EC',
        'warning-border': '#F5D3A1',
        'warning-text':   '#B26010',

        // ── Ink — indigo neutrals ─────────────────────────────────────────
        'ink':   '#172347',
        'ink-2': '#243566',
        'ink-3': '#6473A6',
        'ink-4': '#A0ABD1',

        // ── Utility ───────────────────────────────────────────────────────
        'on-grad':   '#FFFFFF',
        'on-grad-2': '#FFFFFFBF',
        'success':   '#059669',
        'danger':    '#E11D48',
      },

      fontFamily: {
        display: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        sans:    ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
      },

      fontSize: {
        'caption': ['12px', { lineHeight: '1.4',  letterSpacing: '0.01em'  }],
        'label':   ['14px', { lineHeight: '1.4',  letterSpacing: '0em'     }],
        'body':    ['16px', { lineHeight: '1.5',  letterSpacing: '0em'     }],
        'value':   ['20px', { lineHeight: '1.3',  letterSpacing: '-0.01em' }],
        'display': ['28px', { lineHeight: '1.15', letterSpacing: '-0.01em' }],
        'hero':    ['36px', { lineHeight: '1.05', letterSpacing: '-0.02em' }],
      },

      borderRadius: {
        'card':    '16px',
        'card-lg': '20px',
        'hero':    '24px',
        'chip':    '8px',
        'pill':    '9999px',
      },

      boxShadow: {
        'card':       '0 2px 7px rgba(18,28,74,0.06), 0 0 0 0.5px rgba(18,28,74,0.08)',
        'card-md':    '0 4px 14px rgba(18,28,74,0.10), 0 0 0 0.5px rgba(18,28,74,0.08)',
        'card-lg':    '0 8px 24px rgba(18,28,74,0.14), 0 0 0 0.5px rgba(18,28,74,0.08)',
        'apple-card': '0 20px 48px rgba(30,27,75,0.18), 0 8px 20px rgba(30,27,75,0.10)',
        'fab':        '0 6px 18px rgba(30,58,138,0.32)',
        'focus':      '0 0 0 3px rgba(30,58,138,0.30)',
        'urgent':     '0 2px 8px rgba(225,29,72,0.20), 0 0 0 0.5px rgba(225,29,72,0.15)',
        'warn':       '0 2px 8px rgba(202,138,4,0.20), 0 0 0 0.5px rgba(202,138,4,0.15)',
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
      },
      animation: {
        'sheet-in':  'sheet-in 0.30s cubic-bezier(0.32,0.72,0,1) forwards',
        'fade-in':   'fade-in 0.2s ease forwards',
        'slide-up':  'slide-up 0.22s ease forwards',
        'swipe-out': 'swipe-out 0.22s ease forwards',
        'scale-in':  'scale-in 0.18s ease forwards',
      },
    },
  },
  plugins: [],
}
