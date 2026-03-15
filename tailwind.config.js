/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // ── App backgrounds ──────────────────────────────────────────────
        'kosha-bg':            '#FFFFFF',
        'kosha-bg-2':          '#F5FAF0',
        'kosha-surface':       '#FFFFFF',
        'kosha-surface-2':     '#F2F8EC',
        'kosha-border':        '#D6ECC4',
        'kosha-border-strong': '#A8D48A',

        // ── Brand — Wise Forest Green ─────────────────────────────────────
        'brand':           '#163300',
        'brand-dark':      '#0A1F00',
        'brand-container': '#C8F5A0',
        'brand-on':        '#163300',

        // ── Income ────────────────────────────────────────────────────────
        'income':        '#38A169',
        'income-bg':     '#F0FFF4',
        'income-text':   '#276749',
        'income-border': '#9AE6B4',

        // ── Expense ───────────────────────────────────────────────────────
        'expense':        '#FF4757',
        'expense-bg':     '#FFF0F1',
        'expense-text':   '#D42B3A',
        'expense-border': '#FFB3BA',

        // ── Investment ────────────────────────────────────────────────────
        'invest':        '#2B8A68',
        'invest-bg':     '#E6F7F0',
        'invest-text':   '#1A5C45',
        'invest-border': '#81D4B8',

        // ── Repayment ─────────────────────────────────────────────────────
        'repay':        '#FF9500',
        'repay-bg':     '#FFF5E6',
        'repay-text':   '#B35A00',
        'repay-border': '#FFCC80',

        // ── Ink ───────────────────────────────────────────────────────────
        'ink':   '#0D1A08',
        'ink-2': '#2A3A22',
        'ink-3': '#7A8F6E',
        'ink-4': '#C0CCB6',

        // ── Utility ───────────────────────────────────────────────────────
        'on-grad':        '#FFFFFF',
        'on-grad-2':      '#FFFFFFBF',
        'warning':        '#FF9500',
        'warning-bg':     '#FFF5E6',
        'warning-border': '#FFCC80',
        'warning-text':   '#B35A00',
        'success':        '#38A169',
        'danger':         '#FF4757',
      },

      fontFamily: {
        display: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        sans:    ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
      },

      // ── 6-step type scale ─────────────────────────────────────────────
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
        'card':       '0 2px 8px rgba(0,0,0,0.06), 0 0 0 0.5px rgba(22,51,0,0.06)',
        'card-md':    '0 4px 16px rgba(0,0,0,0.08), 0 0 0 0.5px rgba(22,51,0,0.06)',
        'card-lg':    '0 8px 32px rgba(0,0,0,0.10), 0 0 0 0.5px rgba(22,51,0,0.06)',
        'apple-card': '0 20px 60px rgba(0,0,0,0.16), 0 8px 20px rgba(0,0,0,0.08)',
        'fab':        '0 4px 20px rgba(22,51,0,0.35)',
        'focus':      '0 0 0 3.5px rgba(22,51,0,0.20)',
        'urgent':     '0 2px 8px rgba(255,59,48,0.20), 0 0 0 0.5px rgba(255,59,48,0.15)',
        'warn':       '0 2px 8px rgba(255,149,0,0.20), 0 0 0 0.5px rgba(255,149,0,0.15)',
      },

      keyframes: {
        'sheet-in': {
          '0%':   { transform: 'translateY(100%)' },
          '72%':  { transform: 'translateY(-4px)' },
          '100%': { transform: 'translateY(0)' },
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
