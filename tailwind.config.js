/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // ── Material You inspired surfaces ───────────────────────────────
        'kosha-bg':            '#F5F8FF',
        'kosha-bg-2':          '#EAF1FF',
        'kosha-surface':       '#FFFFFF',
        'kosha-surface-2':     '#F1F4FA',
        'kosha-border':        '#D9E2F1',
        'kosha-border-strong': '#A9B8D3',

        // ── Primary / Tonal palette (Google blue family) ────────────────
        'brand':           '#0B57D0',
        'brand-dark':      '#0A3F99',
        'brand-mid':       '#4285F4',
        'brand-container': '#D3E3FD',
        'brand-on':        '#0842A0',
        'brand-accent':    '#A8C7FA',

        // ── Income ────────────────────────────────────────────────────────
        'income':        '#0F9D58',
        'income-bg':     '#E6F4EA',
        'income-text':   '#137333',
        'income-border': '#B7E1CD',

        // ── Expense ───────────────────────────────────────────────────────
        'expense':        '#C5221F',
        'expense-bg':     '#FCE8E6',
        'expense-text':   '#A50E0E',
        'expense-border': '#F6AEA9',

        // ── Investment ────────────────────────────────────────────────────
        'invest':        '#1A73E8',
        'invest-bg':     '#E8F0FE',
        'invest-text':   '#174EA6',
        'invest-border': '#C6DAFC',

        // ── Repayment / Bills ─────────────────────────────────────────────
        'repay':        '#B06000',
        'repay-bg':     '#FEEFC3',
        'repay-text':   '#8A4B00',
        'repay-border': '#F8D57E',

        // ── Warning ───────────────────────────────────────────────────────
        'warning':        '#C26401',
        'warning-bg':     '#FFF4E5',
        'warning-border': '#FBD8A4',
        'warning-text':   '#9D4E00',

        // ── Ink — indigo-tinted neutrals ──────────────────────────────────
        'ink':   '#1F2937',
        'ink-2': '#334155',
        'ink-3': '#64748B',
        'ink-4': '#94A3B8',

        // ── Utility ───────────────────────────────────────────────────────
        'on-grad':   '#FFFFFF',
        'on-grad-2': '#FFFFFFBF',
        'success':   '#059669',
        'danger':    '#E11D48',
      },

      fontFamily: {
        display: ['Roboto', 'system-ui', 'sans-serif'],
        sans:    ['Roboto', 'system-ui', 'sans-serif'],
      },

      fontSize: {
        'caption': ['12px', { lineHeight: '1.35', letterSpacing: '0.01em'  }],
        'label':   ['14px', { lineHeight: '1.35', letterSpacing: '0.005em' }],
        'body':    ['16px', { lineHeight: '1.45', letterSpacing: '0.005em' }],
        'value':   ['22px', { lineHeight: '1.2',  letterSpacing: '-0.01em' }],
        'display': ['30px', { lineHeight: '1.08', letterSpacing: '-0.015em' }],
        'hero':    ['38px', { lineHeight: '1.02', letterSpacing: '-0.02em' }],
      },

      borderRadius: {
        'card':    '20px',
        'card-lg': '26px',
        'hero':    '30px',
        'chip':    '10px',
        'pill':    '9999px',
      },

      boxShadow: {
        'card':       '0 1px 2px rgba(15,23,42,0.06), 0 0 0 1px rgba(148,163,184,0.14)',
        'card-md':    '0 6px 18px rgba(15,23,42,0.10), 0 0 0 1px rgba(148,163,184,0.16)',
        'card-lg':    '0 14px 30px rgba(15,23,42,0.14), 0 0 0 1px rgba(148,163,184,0.18)',
        'apple-card': '0 24px 50px rgba(11,87,208,0.22), 0 10px 28px rgba(15,23,42,0.14)',
        'fab':        '0 8px 24px rgba(11,87,208,0.30)',
        'focus':      '0 0 0 3px rgba(66,133,244,0.28)',
        'urgent':     '0 8px 22px rgba(197,34,31,0.18), 0 0 0 1px rgba(197,34,31,0.20)',
        'warn':       '0 8px 22px rgba(194,100,1,0.16), 0 0 0 1px rgba(194,100,1,0.18)',
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
