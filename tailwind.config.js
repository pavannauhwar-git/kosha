/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // ── App backgrounds ───────────────────────────────────────────────
        'kosha-bg':            '#FEFEFF',
        'kosha-bg-2':          '#FAFBFF',
        'kosha-surface':       '#FFFFFF',
        'kosha-surface-2':     '#F8FAFF',
        'kosha-border':        '#B8C4FF',
        'kosha-border-strong': '#4E63F0',

        // ── Brand — Zaffre + Sport Lime ──────────────────────────────────
        'brand':           '#0014A8',
        'brand-dark':      '#000B73',
        'brand-mid':       '#1E36D8',
        'brand-bg':        '#EEF1FF',
        'brand-container': '#E2E7FF',
        'brand-on':        '#001171',
        'brand-accent':    '#ECFF98',

        // ── Income ────────────────────────────────────────────────────────
        'income':        '#059669',
        'income-bg':     '#ECFDF5',
        'income-text':   '#047857',
        'income-border': '#A7F3D0',

        // ── Expense ───────────────────────────────────────────────────────
        'expense':        '#E11D48',
        'expense-bg':     '#FFF1F2',
        'expense-text':   '#BE123C',
        'expense-border': '#FECDD3',

        // ── Investment ────────────────────────────────────────────────────
        'invest':        '#C026D3',
        'invest-bg':     '#F9ECFB',
        'invest-text':   '#7A1F84',
        'invest-border': '#EEC5F5',

        // ── Repayment / Bills ─────────────────────────────────────────────
        'repay':        '#A16207',
        'repay-bg':     '#FEFCE8',
        'repay-text':   '#854D0E',
        'repay-border': '#FEF08A',

        // ── Warning ───────────────────────────────────────────────────────
        'warning':        '#D97706',
        'warning-bg':     '#FFFBEB',
        'warning-border': '#FDE68A',
        'warning-text':   '#B45309',

        // ── Ink — indigo-tinted neutrals ──────────────────────────────────
        'ink':   '#141B47',
        'ink-2': '#26306D',
        'ink-3': '#5E6AA8',
        'ink-4': '#99A4D1',

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
        'fab':        '0 4px 14px rgba(0,20,168,0.36)',
        'focus':      '0 0 0 3px rgba(0,20,168,0.36)',
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
