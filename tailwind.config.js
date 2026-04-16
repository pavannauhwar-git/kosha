/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        /* ── App backgrounds — Vibrant Clarity ─────────────────────── */
        'kosha-bg':            'var(--ds-surface-dim)',
        'kosha-bg-2':          'var(--ds-surface-container)',
        'kosha-surface':       'var(--ds-surface)',
        'kosha-surface-2':     'var(--ds-surface-bright)',
        'kosha-border':        'var(--ds-border)',
        'kosha-border-strong': 'var(--ds-border-strong)',

        /* ── Brand — Vibrant Blue ──────────────────────────────────── */
        'brand':           'var(--ds-primary)',
        'brand-dark':      'var(--ds-primary-dark)',
        'brand-mid':       'var(--ds-primary-light)',
        'brand-bg':        'var(--ds-surface-dim)',
        'brand-container': 'var(--ds-primary-container)',
        'brand-on':        'var(--ds-on-primary)',
        'accent':          'var(--ds-accent)',
        'accent-text':     'var(--ds-accent-text)',
        'brand-accent':    'var(--ds-accent)',

        /* ── Income — Emerald ──────────────────────────────────────── */
        'income':        'var(--ds-income)',
        'income-bg':     'var(--ds-income-bg)',
        'income-text':   'var(--ds-income-text)',
        'income-border': '#C8E6C9',

        /* ── Expense — Coral ───────────────────────────────────────── */
        'expense':        'var(--ds-expense)',
        'expense-bg':     'var(--ds-expense-bg)',
        'expense-text':   'var(--ds-expense-text)',
        'expense-border': '#FFCDD2',

        /* ── Investment — Indigo ───────────────────────────────────── */
        'invest':        'var(--ds-invest)',
        'invest-bg':     'var(--ds-invest-bg)',
        'invest-text':   'var(--ds-invest-text)',
        'invest-border': '#C5CAE9',

        /* ── Repayment / Bills — Amber ─────────────────────────────── */
        'repay':        'var(--ds-repay)',
        'repay-bg':     'var(--ds-repay-bg)',
        'repay-text':   'var(--ds-repay-text)',
        'repay-border': '#FFF9C4',

        /* ── Warning ───────────────────────────────────────────────── */
        'warning':        'var(--ds-warning)',
        'warning-bg':     'var(--ds-warning-bg)',
        'warning-border': '#FFE0B2',
        'warning-text':   'var(--ds-expense-text)',

        /* ── Ink / Text ────────────────────────────────────────────── */
        'ink':   'var(--ds-text)',
        'ink-2': 'var(--ds-text-secondary)',
        'ink-3': 'var(--ds-text-tertiary)',
        'ink-4': 'var(--ds-text-disabled)',

        /* ── Utility ───────────────────────────────────────────────── */
        'on-grad':   '#FFFFFF',
        'on-grad-2': 'rgba(255,255,255,0.75)',
        'success':   'var(--ds-success)',
        'danger':    'var(--ds-danger)',
      },

      fontFamily: {
        sans: ['InterVariable', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },

      fontSize: {
        'caption': ['11px', { lineHeight: '1.45', letterSpacing: '0.02em' }],
        'label':   ['13px', { lineHeight: '1.4',  letterSpacing: '0.005em' }],
        'body':    ['15px', { lineHeight: '1.55', letterSpacing: '0em' }],
        'value':   ['22px', { lineHeight: '1.2',  letterSpacing: '-0.02em' }],
        'display': ['32px', { lineHeight: '1.05', letterSpacing: '-0.025em' }],
        'hero':    ['42px', { lineHeight: '0.95', letterSpacing: '-0.03em' }],
      },

      borderRadius: {
        'card':    '20px',
        'card-lg': '24px',
        'hero':    '28px',
        'chip':    '10px',
        'pill':    '9999px',
      },

      boxShadow: {
        'card':       'var(--ds-shadow-sm)',
        'card-md':    'var(--ds-shadow-md)',
        'card-lg':    'var(--ds-shadow-lg)',
        'apple-card': 'var(--ds-shadow-xl)',
        'fab':        '0 6px 20px rgba(0,127,255,0.30), 0 2px 8px rgba(0,127,255,0.15)',
        'focus':      'var(--ds-focus-ring)',
        'urgent':     '0 2px 8px rgba(232,69,60,0.12)',
        'warn':       '0 2px 8px rgba(249,168,37,0.12)',
        'glass':      '0 8px 32px rgba(17,19,24,0.06), inset 0 0.5px 0 rgba(255,255,255,0.6)',
        'hero-card':  '0 24px 64px rgba(0,127,255,0.18), 0 8px 24px rgba(17,19,24,0.12)',
      },

      keyframes: {
        'sheet-in': {
          '0%':   { transform: 'translateY(100%)' },
          '72%':  { transform: 'translateY(-3px)' },
          '100%': { transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
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
        'skeleton-pulse': {
          '0%':   { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        'count-up': {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'sheet-in':       'sheet-in 0.4s cubic-bezier(0.05,0.7,0.1,1) forwards',
        'fade-in':        'fade-in 0.2s cubic-bezier(0.2,0,0,1) forwards',
        'slide-up':       'slide-up 0.4s cubic-bezier(0.05,0.7,0.1,1) forwards',
        'swipe-out':      'swipe-out 0.2s cubic-bezier(0.2,0,0,1) forwards',
        'scale-in':       'scale-in 0.4s cubic-bezier(0.05,0.7,0.1,1) forwards',
        'float':          'float 3s ease-in-out infinite',
        'skeleton-pulse': 'skeleton-pulse 2s ease-in-out infinite',
        'count-up':       'count-up 0.5s cubic-bezier(0.05,0.7,0.1,1) forwards',
      },
    },
  },
  plugins: [],
}
