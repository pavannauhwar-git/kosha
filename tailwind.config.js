/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // ── App backgrounds ───────────────────────────────────────────────
        'kosha-bg':            '#FFFEFC',
        'kosha-bg-2':          '#FFFCF7',
        'kosha-surface':       '#FFFFFF',
        'kosha-surface-2':     '#F7FAFF',
        'kosha-border':        '#B9D7FF',
        'kosha-border-strong': '#67AEF5',

        // ── Brand — Azure + Soft Lemon ──────────────────────────────────
        'brand':           '#0A67D8',
        'brand-dark':      '#0850AC',
        'brand-mid':       '#2B84EC',
        'brand-bg':        '#EDF5FF',
        'brand-container': '#E7F2FF',
        'brand-on':        '#0A4A9A',
        'brand-accent':    '#FFFF99',

        // ── Income ────────────────────────────────────────────────────────
        'income':        '#12966C',
        'income-bg':     '#E8F8F1',
        'income-text':   '#0B7656',
        'income-border': '#A5E9CE',

        // ── Expense ───────────────────────────────────────────────────────
        'expense':        '#DF3E62',
        'expense-bg':     '#FFF1F5',
        'expense-text':   '#B42C4D',
        'expense-border': '#F9C8D6',

        // ── Investment ────────────────────────────────────────────────────
        'invest':        '#4D6BEE',
        'invest-bg':     '#EEF2FF',
        'invest-text':   '#374CC0',
        'invest-border': '#CDD8FF',

        // ── Repayment / Bills ─────────────────────────────────────────────
        'repay':        '#9A7200',
        'repay-bg':     '#FFF9DD',
        'repay-text':   '#7C5A00',
        'repay-border': '#F2DD9E',

        // ── Warning ───────────────────────────────────────────────────────
        'warning':        '#A37700',
        'warning-bg':     '#FFF9DD',
        'warning-border': '#F2DD9E',
        'warning-text':   '#7C5A00',

        // ── Ink — blue neutrals ───────────────────────────────────────────
        'ink':   '#10213F',
        'ink-2': '#1D355F',
        'ink-3': '#5D6D8F',
        'ink-4': '#96A5C6',

        // ── Utility ───────────────────────────────────────────────────────
        'on-grad':   '#FFFFFF',
        'on-grad-2': '#FFFFFFBF',
        'success':   '#12966C',
        'danger':    '#DF3E62',
      },

      fontFamily: {
        display: ['Roboto', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        sans:    ['Roboto', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
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
        'card':       '0 16px 30px rgba(16,33,63,0.08), 0 4px 10px rgba(16,33,63,0.05), inset 0 1px 0 rgba(255,255,255,0.86)',
        'card-md':    '0 20px 36px rgba(16,33,63,0.11), 0 6px 14px rgba(16,33,63,0.07), inset 0 1px 0 rgba(255,255,255,0.86)',
        'card-lg':    '0 24px 44px rgba(16,33,63,0.14), 0 8px 18px rgba(16,33,63,0.08), inset 0 1px 0 rgba(255,255,255,0.86)',
        'apple-card': '0 20px 48px rgba(30,27,75,0.18), 0 8px 20px rgba(30,27,75,0.10)',
        'fab':        '0 6px 18px rgba(10,103,216,0.32)',
        'focus':      '0 0 0 3px rgba(10,103,216,0.30)',
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
