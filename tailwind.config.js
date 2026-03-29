/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // ── App backgrounds — Stripe-inspired light ────────────────
        'kosha-bg':            '#ffffff',
        'kosha-bg-2':          '#f6f9fc',
        'kosha-surface':       'rgba(0,0,0,0.03)',
        'kosha-surface-2':     'rgba(0,0,0,0.015)',
        'kosha-border':        'rgba(0,0,0,0.08)',
        'kosha-border-strong': 'rgba(0,0,0,0.16)',

        // ── Brand — Stripe Indigo ──────────────────────────────────
        'brand':           '#635bff',
        'brand-dark':      '#4b45c6',
        'brand-mid':       '#7a73ff',
        'brand-bg':        'rgba(99,91,255,0.08)',
        'brand-container': 'rgba(99,91,255,0.10)',
        'brand-on':        '#635bff',
        'brand-accent':    '#0a2540',

        // ── Income ────────────────────────────────────────────────────
        'income':        '#0e9f6e',
        'income-bg':     'rgba(14,159,110,0.08)',
        'income-text':   '#0e9f6e',
        'income-border': 'rgba(14,159,110,0.20)',

        // ── Expense ───────────────────────────────────────────────────
        'expense':        '#e8364e',
        'expense-bg':     'rgba(232,54,78,0.08)',
        'expense-text':   '#e8364e',
        'expense-border': 'rgba(232,54,78,0.20)',

        // ── Investment ────────────────────────────────────────────────
        'invest':        '#7c3aed',
        'invest-bg':     'rgba(124,58,237,0.08)',
        'invest-text':   '#7c3aed',
        'invest-border': 'rgba(124,58,237,0.20)',

        // ── Repayment / Bills ─────────────────────────────────────────
        'repay':        '#d97706',
        'repay-bg':     'rgba(217,119,6,0.08)',
        'repay-text':   '#d97706',
        'repay-border': 'rgba(217,119,6,0.20)',

        // ── Warning ───────────────────────────────────────────────────
        'warning':        '#d97706',
        'warning-bg':     'rgba(217,119,6,0.08)',
        'warning-border': 'rgba(217,119,6,0.20)',
        'warning-text':   '#d97706',

        // ── Ink — dark on light ───────────────────────────────────────
        'ink':   '#0a2540',
        'ink-2': '#425466',
        'ink-3': '#6b7c93',
        'ink-4': '#8898aa',

        // ── Utility ───────────────────────────────────────────────────
        'on-grad':   '#FFFFFF',
        'on-grad-2': 'rgba(255,255,255,0.85)',
        'success':   '#0e9f6e',
        'danger':    '#e8364e',
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
        'card':       '0 2px 8px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.06)',
        'card-md':    '0 4px 16px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.05)',
        'card-lg':    '0 8px 32px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.05)',
        'apple-card': '0 24px 64px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.06)',
        'fab':        '0 4px 16px rgba(99,91,255,0.35), 0 0 0 1px rgba(99,91,255,0.50)',
        'focus':      '0 0 0 3px rgba(99,91,255,0.25)',
        'urgent':     '0 2px 12px rgba(232,54,78,0.15), 0 0 0 1px rgba(232,54,78,0.12)',
        'warn':       '0 2px 12px rgba(217,119,6,0.15), 0 0 0 1px rgba(217,119,6,0.12)',
        'glow':       '0 0 60px rgba(99,91,255,0.08), 0 0 120px rgba(99,91,255,0.04)',
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
