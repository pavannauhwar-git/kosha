/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // ── App backgrounds ───────────────────────────────────────────────
        'kosha-bg':            '#F8FAFC',
        'kosha-bg-2':          '#F1F5F9',
        'kosha-surface':       '#FFFFFF',
        'kosha-surface-2':     '#F8FAFC',
        'kosha-border':        '#E2E8F0',
        'kosha-border-strong': '#CBD5E1',

        // ── Brand — Royal Indigo & Chartreuse ──────────────────────────
        'brand':           '#5b21b6', // Royal Indigo
        'brand-dark':      '#312e81',
        'brand-mid':       '#6d28d9',
        'brand-bg':        '#f5f3ff',
        'brand-container': '#ede9fe',
        'brand-on':        '#312e81',
        'brand-accent':    '#7FFF00', // Chartreuse

        // ── Income ────────────────────────────────────────────────────────
        'income':        '#10B981',
        'income-bg':     '#ECFDF5',
        'income-text':   '#047857',
        'income-border': '#A7F3D0',

        // ── Expense ───────────────────────────────────────────────────────
        'expense':        '#F43F5E',
        'expense-bg':     '#FFF1F2',
        'expense-text':   '#BE123C',
        'expense-border': '#FECDD3',

        // ── Investment ────────────────────────────────────────────────────
        'invest':        '#8B5CF6',
        'invest-bg':     '#F5F3FF',
        'invest-text':   '#5B21B6',
        'invest-border': '#C4B5FD',

        // ── Repayment / Bills ─────────────────────────────────────────────
        'repay':        '#F59E0B',
        'repay-bg':     '#FFFBEB',
        'repay-text':   '#B45309',
        'repay-border': '#FDE68A',

        // ── Warning ───────────────────────────────────────────────────────
        'warning':        '#F59E0B',
        'warning-bg':     '#FFFBEB',
        'warning-border': '#FDE68A',
        'warning-text':   '#B45309',

        // ── Ink — Slate Neutrals ──────────────────────────────────────────
        'ink':   '#0F172A',
        'ink-2': '#334155',
        'ink-3': '#64748B',
        'ink-4': '#94A3B8',

        // ── Utility ───────────────────────────────────────────────────────
        'on-grad':   '#FFFFFF',
        'on-grad-2': '#FFFFFFBF',
        'success':   '#10B981',
        'danger':    '#F43F5E',
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
        'card':       '0 1px 3px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)',
        'card-md':    '0 4px 6px -1px rgba(15,23,42,0.1), 0 2px 4px -1px rgba(15,23,42,0.06)',
        'card-lg':    '0 10px 15px -3px rgba(15,23,42,0.1), 0 4px 6px -2px rgba(15,23,42,0.05)',
        'apple-card': '0 20px 40px -10px rgba(15,23,42,0.12), 0 8px 16px -4px rgba(15,23,42,0.08)',
        'fab':        '0 4px 14px rgba(79,70,229,0.36)',
        'focus':      '0 0 0 3px rgba(79,70,229,0.30)',
        'urgent':     '0 4px 6px -1px rgba(244,63,94,0.20), 0 2px 4px -1px rgba(244,63,94,0.15)',
        'warn':       '0 4px 6px -1px rgba(245,158,11,0.20), 0 2px 4px -1px rgba(245,158,11,0.15)',
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
