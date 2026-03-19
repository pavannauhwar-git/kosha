/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // ── App backgrounds ───────────────────────────────────────────────
        'kosha-bg':            '#FDFCFF',
        'kosha-bg-2':          '#F5F3FF',
        'kosha-surface':       '#FFFFFF',
        'kosha-surface-2':     '#F5F3FF',
        'kosha-border':        '#D4CEFF',
        'kosha-border-strong': '#8B83E6',

        // ── Brand — Periwinkle + Electric Lime ───────────────────────────
        'brand':           '#3730A3',   // deep indigo — buttons, FAB, active
        'brand-dark':      '#1E1B4B',   // near-black indigo
        'brand-mid':       '#5B51E0',   // mid periwinkle — hero gradient
        'brand-container': '#EDE9FF',   // lavender tint — nav pill, tonal bg
        'brand-on':        '#3730A3',   // text on brand-container
        'brand-accent':    '#E2FF5A',   // electric lime — hero chip, savings

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
        'invest':        '#6D28D9',
        'invest-bg':     '#EDE9FE',
        'invest-text':   '#5B21B6',
        'invest-border': '#C4B5FD',

        // ── Repayment / Bills ─────────────────────────────────────────────
        'repay':        '#CA8A04',
        'repay-bg':     '#FEFCE8',
        'repay-text':   '#A16207',
        'repay-border': '#FEF08A',

        // ── Warning ───────────────────────────────────────────────────────
        'warning':        '#D97706',
        'warning-bg':     '#FFFBEB',
        'warning-border': '#FDE68A',
        'warning-text':   '#B45309',

        // ── Ink — indigo-tinted neutrals ──────────────────────────────────
        'ink':   '#1E1B4B',
        'ink-2': '#312E81',
        'ink-3': '#9590B8',
        'ink-4': '#C4C0E0',

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
        'card':       '0 2px 8px rgba(55,48,163,0.06), 0 0 0 0.5px rgba(55,48,163,0.07)',
        'card-md':    '0 4px 16px rgba(30,27,75,0.10), 0 0 0 0.5px rgba(30,27,75,0.07)',
        'card-lg':    '0 8px 28px rgba(30,27,75,0.13), 0 0 0 0.5px rgba(30,27,75,0.07)',
        'apple-card': '0 20px 48px rgba(30,27,75,0.18), 0 8px 20px rgba(30,27,75,0.10)',
        'fab':        '0 4px 16px rgba(55,48,163,0.40)',
        'focus':      '0 0 0 3.5px rgba(91,81,224,0.28)',
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
        'sheet-in':  'sheet-in 0.40s cubic-bezier(0.32,0.72,0,1) forwards',
        'fade-in':   'fade-in 0.2s ease forwards',
        'slide-up':  'slide-up 0.28s ease forwards',
        'swipe-out': 'swipe-out 0.22s ease forwards',
        'scale-in':  'scale-in 0.22s ease forwards',
      },
    },
  },
  plugins: [],
}
