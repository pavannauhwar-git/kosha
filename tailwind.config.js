/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // ── App backgrounds — warm cream (CRED light) ─────────────────
        'kosha-bg':            '#F5F3EE',
        'kosha-bg-2':          '#EFECE6',
        'kosha-surface':       '#FFFFFF',
        'kosha-surface-2':     '#F9F8F5',
        'kosha-border':        'rgba(26,26,46,0.08)',
        'kosha-border-strong': 'rgba(26,26,46,0.16)',

        // ── Brand — Deep charcoal + warm gold accent ────────────────
        'brand':           '#1A1A2E',
        'brand-dark':      '#0F0F1A',
        'brand-mid':       '#2D2D44',
        'brand-bg':        '#F5F3EE',
        'brand-container': '#EFECE6',
        'brand-on':        '#1A1A2E',
        'brand-accent':    '#C9A96E',

        // ── Income — Muted sage ──────────────────────────────────────
        'income':        '#2D8B6F',
        'income-bg':     '#EFF8F4',
        'income-text':   '#1D6B53',
        'income-border': '#C6E8D9',

        // ── Expense — Muted rose ─────────────────────────────────────
        'expense':        '#C4384A',
        'expense-bg':     '#FDF1F2',
        'expense-text':   '#A22B3B',
        'expense-border': '#F2CDD2',

        // ── Investment — Muted indigo ────────────────────────────────
        'invest':        '#6246B5',
        'invest-bg':     '#F3F0FA',
        'invest-text':   '#4A2F9A',
        'invest-border': '#D8CFF0',

        // ── Repayment / Bills ────────────────────────────────────────
        'repay':        '#8B7230',
        'repay-bg':     '#FAF6EC',
        'repay-text':   '#6B5620',
        'repay-border': '#E8DDB8',

        // ── Warning ─────────────────────────────────────────────────
        'warning':        '#8B7230',
        'warning-bg':     '#FAF6EC',
        'warning-border': '#E8DDB8',
        'warning-text':   '#6B5620',

        // ── Ink — warm neutrals ──────────────────────────────────────
        'ink':   '#1A1A2E',
        'ink-2': '#2D2D44',
        'ink-3': '#6B6B80',
        'ink-4': '#A3A3B5',

        // ── Utility ─────────────────────────────────────────────────
        'on-grad':   '#FFFFFF',
        'on-grad-2': '#FFFFFFBF',
        'success':   '#2D8B6F',
        'danger':    '#C4384A',
      },

      fontFamily: {
        sans:    ['InterVariable', 'Inter', 'system-ui', 'sans-serif'],
      },

      fontSize: {
        'caption': ['11px', { lineHeight: '1.45', letterSpacing: '0.02em'  }],
        'label':   ['13px', { lineHeight: '1.45', letterSpacing: '0.005em' }],
        'body':    ['15px', { lineHeight: '1.55', letterSpacing: '0em'     }],
        'value':   ['22px', { lineHeight: '1.25', letterSpacing: '-0.02em' }],
        'display': ['32px', { lineHeight: '1.1',  letterSpacing: '-0.025em' }],
        'hero':    ['42px', { lineHeight: '1.0',  letterSpacing: '-0.03em' }],
      },

      borderRadius: {
        'card':    '20px',
        'card-lg': '24px',
        'hero':    '28px',
        'chip':    '10px',
        'pill':    '9999px',
      },

      boxShadow: {
        'card':       '0 1px 3px rgba(26,26,46,0.04), 0 4px 12px rgba(26,26,46,0.03)',
        'card-md':    '0 2px 8px rgba(26,26,46,0.06), 0 8px 24px rgba(26,26,46,0.04)',
        'card-lg':    '0 4px 16px rgba(26,26,46,0.08), 0 12px 40px rgba(26,26,46,0.06)',
        'apple-card': '0 24px 56px rgba(26,26,46,0.12), 0 8px 20px rgba(26,26,46,0.06)',
        'fab':        '0 8px 24px rgba(26,26,46,0.20), 0 2px 8px rgba(26,26,46,0.10)',
        'focus':      '0 0 0 3px rgba(26,26,46,0.12)',
        'urgent':     '0 2px 8px rgba(196,56,74,0.12)',
        'warn':       '0 2px 8px rgba(139,114,48,0.12)',
        'glass':      '0 8px 32px rgba(26,26,46,0.08), inset 0 0.5px 0 rgba(255,255,255,0.5)',
        'hero-card':  '0 20px 60px rgba(26,26,46,0.25), 0 8px 20px rgba(26,26,46,0.15)',
      },

      keyframes: {
        'sheet-in': {
          '0%':   { transform: 'translateY(100%)' },
          '72%':  { transform: 'translateY(-3px)'  },
          '100%': { transform: 'translateY(0)'     },
        },
        'fade-in':  { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'slide-up': {
          '0%':   { transform: 'translateY(16px)', opacity: '0' },
          '100%': { transform: 'translateY(0)',    opacity: '1' },
        },
        'swipe-out': {
          '0%':   { transform: 'translateX(0)',     opacity: '1' },
          '100%': { transform: 'translateX(-100%)', opacity: '0' },
        },
        'scale-in': {
          '0%':   { transform: 'scale(0.96)', opacity: '0' },
          '100%': { transform: 'scale(1)',    opacity: '1' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(-4px)' },
        },
      },
      animation: {
        'sheet-in':  'sheet-in 0.36s cubic-bezier(0.32,0.72,0,1) forwards',
        'fade-in':   'fade-in 0.24s ease forwards',
        'slide-up':  'slide-up 0.28s cubic-bezier(0.22,1,0.36,1) forwards',
        'swipe-out': 'swipe-out 0.24s ease forwards',
        'scale-in':  'scale-in 0.22s cubic-bezier(0.22,1,0.36,1) forwards',
        'float':     'float 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
