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
        'caption': ['11px', { lineHeight: '1.45', letterSpacing: '0.03em' }],
        'label':   ['13px', { lineHeight: '1.4',  letterSpacing: '0.01em' }],
        'body':    ['15px', { lineHeight: '1.55', letterSpacing: '0em' }],
        'value':   ['22px', { lineHeight: '1.2',  letterSpacing: '-0.025em' }],
        'display': ['32px', { lineHeight: '1.05', letterSpacing: '-0.03em' }],
        'hero':    ['42px', { lineHeight: '0.95', letterSpacing: '-0.04em' }],
      },

      borderRadius: {
        // Official Material 3 Shape Scale
        'md3-none': 'var(--md-sys-shape-none)',
        'md3-xs':   'var(--md-sys-shape-xs)',
        'md3-sm':   'var(--md-sys-shape-sm)',
        'md3-md':   'var(--md-sys-shape-md)',
        'md3-lg':   'var(--md-sys-shape-lg)',
        'md3-xl':   'var(--md-sys-shape-xl)',
        'md3-full': 'var(--md-sys-shape-full)',

        // Mapping legacy aliases for zero regressions & instant visual upgrades
        'card':    'var(--md-sys-shape-lg)',   // Replaced 20px with standard M3 Large (16px) for crisp cards
        'card-lg': 'var(--md-sys-shape-xl)',   // Replaced 24px with standard M3 Extra Large (28px)
        'hero':    'var(--md-sys-shape-xl)',   // 28px
        'chip':    'var(--md-sys-shape-sm)',   // 8px
        'pill':    'var(--md-sys-shape-full)', // 9999px
      },

      boxShadow: {
        'card':       'var(--ds-shadow-sm)',
        'card-md':    'var(--ds-shadow-md)',
        'card-lg':    'var(--ds-shadow-lg)',
        'apple-card': 'var(--ds-shadow-xl)',
        'fab':        'var(--ds-shadow-fab)',
        'focus':      'var(--ds-focus-ring)',
        'urgent':     '0 2px 8px rgba(232,69,60,0.12)',
        'warn':       '0 2px 8px rgba(249,168,37,0.12)',
        'glass':      '0 8px 32px rgba(17,19,24,0.06), inset 0 0.5px 0 rgba(255,255,255,0.6)',
        'hero-card':  'var(--ds-shadow-hero)',
      },

      keyframes: {
        'sheet-in': {
          '0%':   { transform: 'translateY(100%)' },
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
        'sheet-in':       'sheet-in var(--md-sys-motion-duration-medium4) var(--md-sys-motion-easing-standard-decelerate) forwards',
        'fade-in':        'fade-in var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard) forwards',
        'slide-up':       'slide-up var(--md-sys-motion-duration-medium2) var(--md-sys-motion-easing-standard-decelerate) forwards',
        'swipe-out':      'swipe-out var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard-accelerate) forwards',
        'scale-in':       'scale-in var(--md-sys-motion-duration-medium2) var(--md-sys-motion-easing-standard-decelerate) forwards',
        'skeleton-pulse': 'skeleton-pulse 2s linear infinite',
        'count-up':       'count-up var(--md-sys-motion-duration-medium2) var(--md-sys-motion-easing-standard-decelerate) forwards',
      },
    },
  },
  plugins: [],
}
